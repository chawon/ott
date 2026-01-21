"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, MapPin, MessageSquare, MonitorPlay, Star, Users } from "lucide-react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import CommentsPanel from "@/components/CommentsPanel";
import {
    getTitleLocal,
    getUserId,
    listHistoryLocal,
    listLogsByTitleLocal,
    upsertHistoryLocal,
    upsertLogsLocal,
    upsertTitleLocal,
    updateLogLocal,
    updatePendingCreatePayload,
    enqueueUpdateLog,
} from "@/lib/localStore";
import { syncOutbox } from "@/lib/sync";
import {
    Occasion,
    Place,
    Status,
    Title,
    WatchLog,
    WatchLogHistory,
} from "@/lib/types";
import { formatNoteInline, OCCASION_LABELS, PLACE_LABELS, STATUS_LABELS, ratingDisplay, safeUUID } from "@/lib/utils";

type SeasonOption = {
    seasonNumber: number;
    name: string;
    episodeCount?: number | null;
    posterUrl?: string | null;
    year?: number | null;
};

type EpisodeOption = {
    episodeNumber: number;
    name: string;
};

const PLACE_OPTIONS: { value: Place; label: string }[] = (Object.keys(PLACE_LABELS) as Place[])
    .map((value) => ({ value, label: PLACE_LABELS[value] }));
const OCCASION_OPTIONS: { value: Occasion; label: string }[] = (Object.keys(OCCASION_LABELS) as Occasion[])
    .map((value) => ({ value, label: OCCASION_LABELS[value] }));
const STATUS_OPTIONS: { value: Status; label: string }[] = (Object.keys(STATUS_LABELS) as Status[])
    .map((value) => ({ value, label: STATUS_LABELS[value] }));

const OTT_OPTIONS = [
    "넷플릭스",
    "디즈니플러스",
    "티빙",
    "웨이브",
    "쿠팡플레이",
    "애플티비",
    "프라임비디오",
    "왓챠",
    "채널",
    "VOD",
    "DVD",
    "블루레이",
    "CGV",
    "롯데시네마",
    "메가박스",
    "씨네Q",
] as const;

const OTT_GROUPS = [
    { label: "OTT", options: ["넷플릭스", "디즈니플러스", "티빙", "웨이브", "쿠팡플레이", "애플티비", "프라임비디오", "왓챠"] },
    { label: "유료 방송", options: ["채널", "VOD"] },
    { label: "물리 매체", options: ["DVD", "블루레이"] },
    { label: "극장", options: ["CGV", "롯데시네마", "메가박스", "씨네Q"] },
] as const;

const OTT_CUSTOM_VALUE = "__custom__";
const OTT_CUSTOM_KEY = "watchlog.ott.custom";

function resolveOttSelect(value: string, options: string[]) {
    if (!value) return "";
    return options.includes(value) ? value : OTT_CUSTOM_VALUE;
}

function loadCustomOttOptions(): string[] {
    if (typeof localStorage === "undefined") return [];
    try {
        const raw = localStorage.getItem(OTT_CUSTOM_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((v) => typeof v === "string" && v.trim().length > 0);
    } catch {
        return [];
    }
}

function saveCustomOttOptions(options: string[]) {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(OTT_CUSTOM_KEY, JSON.stringify(options));
}

function fmt(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toDateInput(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function dateToIso(date: string) {
    return new Date(`${date}T00:00:00`).toISOString();
}

function chip(label: string, tone: "place" | "occasion") {
    const toneClass = tone === "place"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
    return (
        <span className={`rounded-full border px-3 py-1 text-xs ${toneClass}`}>
            {label}
        </span>
    );
}

function renderBody(text: string) {
    const parts = text.split(/(@\{[^}]+\})/g);
    return parts.map((p, idx) => {
        if (p.startsWith("@{") && p.endsWith("}")) {
            const name = p.slice(2, -1);
            return (
                <span key={idx} className="rounded-md bg-indigo-50 px-1 text-indigo-700">
                    @{name}
                </span>
            );
        }
        if (p.startsWith("@")) {
            return (
                <span key={idx} className="rounded-md bg-indigo-50 px-1 text-indigo-700">
                    {p}
                </span>
            );
        }
        return <span key={idx}>{p}</span>;
    });
}

function seasonEpisodeLabel(seasonNumber?: number | null, episodeNumber?: number | null) {
    if (typeof seasonNumber !== "number") return null;
    if (typeof episodeNumber === "number") return `S${seasonNumber} · E${episodeNumber}`;
    return `S${seasonNumber}`;
}

export default function TitlePage() {
    const params = useParams<{ id: string }>();
    const rawId = params?.id;
    const titleId = Array.isArray(rawId) ? rawId[0] : rawId;

    const [title, setTitle] = useState<Title | null>(null);
    const [log, setLog] = useState<WatchLog | null>(null);
    const [history, setHistory] = useState<WatchLogHistory[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const [status, setStatus] = useState<Status>("IN_PROGRESS");
    const [rating, setRating] = useState<number | "">("");
    const [ott, setOtt] = useState("");
    const [ottSelect, setOttSelect] = useState<string>("");
    const [note, setNote] = useState("");
    const [place, setPlace] = useState<Place>("HOME");
    const [occasion, setOccasion] = useState<Occasion>("ALONE");
    const [useWatchedAt, setUseWatchedAt] = useState(false);
    const [watchedDate, setWatchedDate] = useState("");
    const [seasons, setSeasons] = useState<SeasonOption[]>([]);
    const [episodes, setEpisodes] = useState<EpisodeOption[]>([]);
    const [selectedSeason, setSelectedSeason] = useState<number | "">("");
    const [selectedEpisode, setSelectedEpisode] = useState<number | "">("");
    const [seasonPosterUrl, setSeasonPosterUrl] = useState<string | null>(null);
    const [seasonYear, setSeasonYear] = useState<number | null>(null);
    const [origin, setOrigin] = useState<WatchLog["origin"]>("LOG");
    const [customOttOptions, setCustomOttOptions] = useState<string[]>([]);
    const [seasonLoading, setSeasonLoading] = useState(false);
    const [episodeLoading, setEpisodeLoading] = useState(false);
    const [seasonError, setSeasonError] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    const allOttOptions = useMemo(() => {
        const base = Array.from(OTT_OPTIONS) as string[];
        const extras = customOttOptions.filter((v) => !base.includes(v));
        return [...base, ...extras];
    }, [customOttOptions]);

    async function reloadAll() {
        if (!titleId) return;
        setLoading(true);
        setErr(null);

        let hadLocal = false;
        try {
            const localApplied = await loadLocalOnly();
            if (localApplied) hadLocal = true;

            const t = await api<Title>(`/titles/${titleId}`);
            const logs = await api<WatchLog[]>(`/logs?titleId=${encodeURIComponent(titleId)}&limit=1`);
            const current = logs[0] ?? null;

            setTitle(t);
            setLog(current);
            await upsertTitleLocal(t);
            await upsertLogsLocal(logs);

            if (current) {
                setStatus(current.status);
                setRating(typeof current.rating === "number" ? current.rating : "");
                setOtt(current.ott ?? "");
                setOttSelect(resolveOttSelect(current.ott ?? "", allOttOptions));
                setNote(current.note ?? "");
                setPlace((current.place ?? "HOME") as Place);
                setOccasion((current.occasion ?? "ALONE") as Occasion);
                setSelectedSeason(typeof current.seasonNumber === "number" ? current.seasonNumber : "");
                setSelectedEpisode(typeof current.episodeNumber === "number" ? current.episodeNumber : "");
                setSeasonPosterUrl(current.seasonPosterUrl ?? null);
                setSeasonYear(typeof current.seasonYear === "number" ? current.seasonYear : null);
                setOrigin(current.origin ?? "LOG");
                setWatchedDate(toDateInput(new Date(current.watchedAt ?? current.createdAt)));

                const h = await api<WatchLogHistory[]>(`/logs/${current.id}/history?limit=50`);
                setHistory(h);
                await upsertHistoryLocal(h);
            } else {
                setHistory([]);
            }
        } catch (e: any) {
            if (!hadLocal) {
                setErr(e?.message ?? "Failed to load");
            }
        } finally {
            setLoading(false);
        }
    }

    async function loadLocalOnly() {
        if (!titleId) return false;
        let applied = false;
        const localTitle = await getTitleLocal(titleId);
        const localLogs = await listLogsByTitleLocal(titleId, 1);
        const localCurrent = localLogs[0] ?? null;

        if (localTitle) {
            applied = true;
            setTitle(localTitle);
        }
            if (localCurrent) {
                applied = true;
                setLog(localCurrent);
                setStatus(localCurrent.status);
                setRating(typeof localCurrent.rating === "number" ? localCurrent.rating : "");
                setOtt(localCurrent.ott ?? "");
                setOttSelect(resolveOttSelect(localCurrent.ott ?? "", allOttOptions));
                setNote(localCurrent.note ?? "");
                setPlace((localCurrent.place ?? "HOME") as Place);
                setOccasion((localCurrent.occasion ?? "ALONE") as Occasion);
                setSelectedSeason(typeof localCurrent.seasonNumber === "number" ? localCurrent.seasonNumber : "");
                setSelectedEpisode(typeof localCurrent.episodeNumber === "number" ? localCurrent.episodeNumber : "");
                setSeasonPosterUrl(localCurrent.seasonPosterUrl ?? null);
                setSeasonYear(typeof localCurrent.seasonYear === "number" ? localCurrent.seasonYear : null);
                setOrigin(localCurrent.origin ?? "LOG");
                setWatchedDate(toDateInput(new Date(localCurrent.watchedAt ?? localCurrent.createdAt)));

                const localHistory = await listHistoryLocal(localCurrent.id, 50);
                if (localHistory.length > 0) setHistory(localHistory);
            }
        return applied;
    }

    useEffect(() => {
        reloadAll();
    }, [titleId]);

    useEffect(() => {
        setCustomOttOptions(loadCustomOttOptions());
    }, []);

    useEffect(() => {
        if (ottSelect === OTT_CUSTOM_VALUE) return;
        setOttSelect(resolveOttSelect(ott, allOttOptions));
    }, [ott, ottSelect, allOttOptions]);

    useEffect(() => {
        if (useWatchedAt && !watchedDate) {
            setWatchedDate(toDateInput(new Date()));
        }
    }, [useWatchedAt, watchedDate]);

    useEffect(() => {
        let cancelled = false;
        async function loadSeasons() {
            if (!title || title.type !== "series" || !title.providerId) return;
            setSeasonLoading(true);
            setSeasonError(null);
            try {
                const res = await api<SeasonOption[]>(`/tmdb/tv/${title.providerId}/seasons`);
                if (!cancelled) setSeasons(res);
            } catch (e: any) {
                if (!cancelled) {
                    setSeasons([]);
                    setSeasonError(e?.message ?? "Failed to load seasons");
                }
            } finally {
                if (!cancelled) setSeasonLoading(false);
            }
        }

        setSeasons([]);
        setEpisodes([]);
        setSeasonError(null);
        setSeasonYear(null);

        if (title?.type === "series" && title.providerId) {
            loadSeasons();
        }

        return () => {
            cancelled = true;
        };
    }, [title]);

    useEffect(() => {
        let cancelled = false;
        async function loadEpisodes() {
            if (!title || title.type !== "series" || !title.providerId) return;
            if (selectedSeason === "") return;
            setEpisodeLoading(true);
            try {
                const res = await api<EpisodeOption[]>(
                    `/tmdb/tv/${title.providerId}/seasons/${selectedSeason}`
                );
                if (!cancelled) setEpisodes(res);
            } catch {
                if (!cancelled) setEpisodes([]);
            } finally {
                if (!cancelled) setEpisodeLoading(false);
            }
        }

        setEpisodes([]);
        if (selectedSeason !== "") {
            const season = seasons.find((s) => s.seasonNumber === selectedSeason);
            setSeasonPosterUrl(season?.posterUrl ?? null);
            setSeasonYear(typeof season?.year === "number" ? season.year : null);
            loadEpisodes();
        } else {
            setSeasonPosterUrl(null);
            setSeasonYear(null);
            setSelectedEpisode("");
        }

        return () => {
            cancelled = true;
        };
    }, [title, selectedSeason, seasons]);

    useEffect(() => {
        setUserId(getUserId());
    }, []);

    useEffect(() => {
        function handleSync() {
            loadLocalOnly();
        }
        window.addEventListener("sync:updated", handleSync);
        return () => window.removeEventListener("sync:updated", handleSync);
    }, [titleId]);

    const isDirty = useMemo(() => {
        if (!log) return false;
        const baselineRating = typeof log.rating === "number" ? log.rating : null;
        const baselineOtt = log.ott ?? "";
        const baselineNote = log.note ?? "";
        const baselinePlace = (log.place ?? "HOME") as Place;
        const baselineOccasion = (log.occasion ?? "ALONE") as Occasion;
        const baselineWatchedDate = toDateInput(new Date(log.watchedAt ?? log.createdAt));
        const baselineSeason = typeof log.seasonNumber === "number" ? log.seasonNumber : "";
        const baselineEpisode = typeof log.episodeNumber === "number" ? log.episodeNumber : "";
        const baselineSeasonYear = typeof log.seasonYear === "number" ? log.seasonYear : null;
        return (
            status !== log.status ||
            (rating === "" ? null : rating) !== baselineRating ||
            ott.trim() !== baselineOtt ||
            note.trim() !== baselineNote ||
            place !== baselinePlace ||
            occasion !== baselineOccasion ||
            selectedSeason !== baselineSeason ||
            selectedEpisode !== baselineEpisode ||
            seasonYear !== baselineSeasonYear ||
            (useWatchedAt && watchedDate && watchedDate !== baselineWatchedDate)
        );
    }, [log, status, rating, ott, note, place, occasion, useWatchedAt, watchedDate, selectedSeason, selectedEpisode, seasonYear]);

    const canUpdate = useMemo(() => !!log && !saving && isDirty, [log, saving, isDirty]);

    async function updateLog() {
        if (!log || saving) return;
        setSaving(true);
        try {
            if (!isDirty) return;
            const now = new Date().toISOString();
            const pickedWatchedAt = useWatchedAt && watchedDate ? dateToIso(watchedDate) : null;
            if (ott.trim()) {
                const trimmed = ott.trim();
                const baseOptions = Array.from(OTT_OPTIONS) as string[];
                if (!baseOptions.includes(trimmed) && !customOttOptions.includes(trimmed)) {
                    const next = [...customOttOptions, trimmed];
                    setCustomOttOptions(next);
                    saveCustomOttOptions(next);
                }
            }
            const payload = {
                id: log.id,
                op: "upsert",
                updatedAt: now,
                payload: {
                    status,
                    rating: rating === "" ? null : rating,
                    ott: ott.trim() ? ott.trim() : null,
                    note: note.trim() ? note.trim() : null,
                    seasonNumber: selectedSeason === "" ? null : selectedSeason,
                    episodeNumber: selectedEpisode === "" ? null : selectedEpisode,
                    seasonPosterUrl: seasonPosterUrl ?? null,
                    seasonYear: seasonYear ?? null,
                    origin,
                    place,
                    occasion,
                    watchedAt: pickedWatchedAt,
                },
            };

            const updatedLocal: WatchLog = {
                ...log,
                status,
                rating: rating === "" ? null : rating,
                ott: ott.trim() ? ott.trim() : null,
                note: note.trim() ? note.trim() : null,
                seasonNumber: selectedSeason === "" ? null : selectedSeason,
                episodeNumber: selectedEpisode === "" ? null : selectedEpisode,
                seasonPosterUrl: seasonPosterUrl ?? null,
                seasonYear: seasonYear ?? null,
                origin,
                place,
                occasion,
                syncStatus: "pending",
                updatedAt: now,
                watchedAt: pickedWatchedAt ?? log.watchedAt,
            };

            setLog(updatedLocal);
            await updateLogLocal(log.id, updatedLocal);
            const historyEntry: WatchLogHistory = {
                id: safeUUID(),
                logId: log.id,
                recordedAt: now,
                status,
                rating: rating === "" ? null : rating,
                note: note.trim() ? note.trim() : null,
                spoiler: false,
                ott: ott.trim() ? ott.trim() : null,
                seasonNumber: selectedSeason === "" ? null : selectedSeason,
                episodeNumber: selectedEpisode === "" ? null : selectedEpisode,
                seasonPosterUrl: seasonPosterUrl ?? null,
                seasonYear: seasonYear ?? null,
                origin,
                watchedAt: pickedWatchedAt ?? log.watchedAt,
                place,
                occasion,
            };
            setHistory((prev) => [historyEntry, ...prev]);
            await upsertHistoryLocal([historyEntry]);

            const mergedIntoCreate = await updatePendingCreatePayload(log.id, payload);
            if (!mergedIntoCreate) {
                await enqueueUpdateLog(log.id, payload);
            }
            await syncOutbox();
        } finally {
            setSaving(false);
        }
    }

    if (!titleId) {
        return (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="text-base font-semibold">Invalid route</div>
            </div>
        );
    }

    if (loading && !title) {
        return (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="text-sm text-neutral-600">Loading…</div>
            </div>
        );
    }

    if (err) {
        return (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="text-base font-semibold">Error</div>
                <div className="mt-2 text-sm text-neutral-700">{err}</div>
            </div>
        );
    }

    if (!title) {
        return (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="text-base font-semibold">Not found</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="h-28 w-20 overflow-hidden rounded-xl bg-neutral-100 sm:h-36 sm:w-24">
                        {(log?.seasonPosterUrl ?? title.posterUrl) ? (
                            <img
                                src={log?.seasonPosterUrl ?? title.posterUrl ?? ""}
                                alt={title.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                            />
                        ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-xl font-semibold">{title.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                            {title.type === "movie" ? "Movie" : "Series"}
                            {(seasonYear ?? title.year) ? ` · ${seasonYear ?? title.year}` : ""}
                        </div>
                        {title.genres && title.genres.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {title.genres.map((g) => (
                                    <span
                                        key={g}
                                        className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700"
                                    >
                                        {g}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                        {title.directors && title.directors.length > 0 ? (
                            <div className="mt-3 text-xs text-neutral-600">
                                감독 · {title.directors.join(", ")}
                            </div>
                        ) : null}
                        {title.cast && title.cast.length > 0 ? (
                            <div className="mt-1 text-xs text-neutral-600">
                                주연 · {title.cast.join(", ")}
                            </div>
                        ) : null}
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
                    <div>
                        <div className="text-base font-semibold">나의 기록</div>
                        <div className="text-sm text-neutral-600">
                            {log ? "내용을 추가하면 히스토리가 자동으로 쌓여요." : "아직 이 작품에 대한 기록이 없어요. 홈에서 먼저 저장해 주세요."}
                        </div>
                    </div>

                    {log ? (
                        <>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <label className="space-y-1">
                                    <div className="text-xs text-neutral-600 flex items-center gap-1.5">
                                        <Clock className="h-3 w-3" />
                                        상태
                                    </div>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as Status)}
                                        className="w-full select-base rounded-xl px-3 py-2 text-sm"
                                    >
                                        {STATUS_OPTIONS.map((s) => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                </label>

                                {title.type === "series" ? (
                                    <label className="space-y-1">
                                        <div className="text-xs text-neutral-600">시즌</div>
                                        <select
                                            value={selectedSeason}
                                            onChange={(e) => setSelectedSeason(e.target.value ? Number(e.target.value) : "")}
                                            className="w-full select-base rounded-xl px-3 py-2 text-sm"
                                        >
                                            <option value="">선택 안함</option>
                                            {seasons.map((s) => (
                                                <option key={s.seasonNumber} value={s.seasonNumber}>
                                                    시즌 {s.seasonNumber}{s.name ? ` · ${s.name}` : ""}
                                                </option>
                                            ))}
                                        </select>
                                        {seasonLoading ? (
                                            <div className="text-[11px] text-neutral-400">시즌 불러오는 중...</div>
                                        ) : null}
                                        {seasonError ? (
                                            <div className="text-[11px] text-red-500">{seasonError}</div>
                                        ) : null}
                                    </label>
                                ) : null}

                                {title.type === "series" ? (
                                    <label className="space-y-1">
                                        <div className="text-xs text-neutral-600">에피소드</div>
                                        <select
                                            value={selectedEpisode}
                                            onChange={(e) => setSelectedEpisode(e.target.value ? Number(e.target.value) : "")}
                                            className="w-full select-base rounded-xl px-3 py-2 text-sm"
                                            disabled={selectedSeason === "" || episodeLoading}
                                        >
                                            <option value="">선택 안함</option>
                                            {episodes.map((e) => (
                                                <option key={e.episodeNumber} value={e.episodeNumber}>
                                                    EP {e.episodeNumber}{e.name ? ` · ${e.name}` : ""}
                                                </option>
                                            ))}
                                        </select>
                                        {episodeLoading ? (
                                            <div className="text-[11px] text-neutral-400">에피소드 불러오는 중...</div>
                                        ) : null}
                                    </label>
                                ) : null}

                                <label className="space-y-1">
                                    <div className="text-xs text-neutral-600 flex items-center gap-1.5">
                                        <Star className="h-3 w-3" />
                                        평점
                                    </div>
                                    <select
                                        value={rating === "" ? "" : String(rating)}
                                        onChange={(e) => setRating(e.target.value === "" ? "" : Number(e.target.value))}
                                        className="w-full select-base rounded-xl px-3 py-2 text-sm"
                                    >
                                        <option value="">선택 안함</option>
                                        <option value="5">😍 나에게 최고</option>
                                        <option value="3">🙂 그럭저럭</option>
                                        <option value="1">😕 나는 실망</option>
                                    </select>
                                </label>

                                <label className="space-y-1">
                                    <div className="text-xs text-neutral-600 flex items-center gap-1.5">
                                        <MapPin className="h-3 w-3" />
                                        장소
                                    </div>
                                    <select
                                        value={place}
                                        onChange={(e) => setPlace(e.target.value as Place)}
                                        className="w-full select-base rounded-xl px-3 py-2 text-sm"
                                    >
                                        {PLACE_OPTIONS.map((p) => (
                                            <option key={p.value} value={p.value}>{p.label}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="space-y-1">
                                    <div className="text-xs text-neutral-600 flex items-center gap-1.5">
                                        <Users className="h-3 w-3" />
                                        누구와
                                    </div>
                                    <select
                                        value={occasion}
                                        onChange={(e) => setOccasion(e.target.value as Occasion)}
                                        className="w-full select-base rounded-xl px-3 py-2 text-sm"
                                    >
                                        {OCCASION_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="space-y-1 md:col-span-2">
                                    <div className="text-xs text-neutral-600 flex items-center gap-1.5">
                                        <MonitorPlay className="h-3 w-3" />
                                        플랫폼
                                    </div>
                                    <select
                                        value={ottSelect}
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            setOttSelect(next);
                                            if (next === OTT_CUSTOM_VALUE) {
                                                setOtt("");
                                            } else {
                                                setOtt(next);
                                            }
                                        }}
                                        className="w-full select-base rounded-xl px-3 py-2 text-sm"
                                    >
                                        <option value="">선택 안함</option>
                                        {OTT_GROUPS.map((g) => (
                                            <optgroup key={g.label} label={g.label}>
                                                {g.options.map((o) => (
                                                    <option key={o} value={o}>{o}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                        {customOttOptions.length > 0 ? (
                                            <optgroup label="내 입력">
                                                {customOttOptions.map((o) => (
                                                    <option key={o} value={o}>{o}</option>
                                                ))}
                                            </optgroup>
                                        ) : null}
                                        <option value={OTT_CUSTOM_VALUE}>직접 입력</option>
                                    </select>
                                    {ottSelect === OTT_CUSTOM_VALUE ? (
                                        <input
                                            value={ott}
                                            onChange={(e) => setOtt(e.target.value)}
                                            className="mt-2 w-full select-base rounded-xl px-3 py-2 text-sm"
                                            placeholder="직접 입력"
                                        />
                                    ) : null}
                                </label>

                                <div className="space-y-2 md:col-span-2">
                                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <input
                                            type="checkbox"
                                            checked={useWatchedAt}
                                            onChange={(e) => setUseWatchedAt(e.target.checked)}
                                        />
                                        날짜 변경
                                    </label>
                                    {useWatchedAt ? (
                                        <input
                                            type="date"
                                            value={watchedDate}
                                            onChange={(e) => setWatchedDate(e.target.value)}
                                            className="w-full select-base rounded-xl px-3 py-2 text-sm"
                                        />
                                    ) : null}
                                </div>

                                <label className="space-y-1 md:col-span-2">
                                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <MessageSquare className="h-3 w-3" />
                                        메모
                                    </div>
                                    <textarea
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        className="w-full select-base rounded-xl px-3 py-2 text-sm"
                                        rows={3}
                                    />
                                </label>
                            </div>

                            <button
                                type="button"
                                disabled={!canUpdate}
                                onClick={updateLog}
                                className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                            >
                                {saving ? "Updating…" : "Update"}
                            </button>
                        </>
                    ) : null}
                </section>

                <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
                    <div>
                        <div className="text-base font-semibold">히스토리</div>
                        <div className="text-sm text-muted-foreground">업데이트할 때마다 스냅샷이 쌓여요.</div>
                    </div>

                    {!log ? (
                        <div className="text-sm text-muted-foreground">아직 히스토리가 없어요.</div>
                    ) : history.length === 0 ? (
                        <div className="text-sm text-muted-foreground">아직 히스토리가 없어요.</div>
                    ) : (
                        <div className="space-y-2">
                            {history.map((h) => (
                                <div key={h.id} className="rounded-xl border border-border bg-card/80 p-4 text-card-foreground">
                                    <div className="text-sm font-semibold text-foreground">
                                        {fmt(h.recordedAt)} · {STATUS_LABELS[h.status]}
                                        {seasonEpisodeLabel(h.seasonNumber, h.episodeNumber) ? ` · ${seasonEpisodeLabel(h.seasonNumber, h.episodeNumber)}` : ""}
                                        {ratingDisplay(h.rating) ? ` · ${ratingDisplay(h.rating)?.emoji} ${ratingDisplay(h.rating)?.label}` : ""}
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                        {h.place ? chip(PLACE_LABELS[h.place], "place") : null}
                                        {h.occasion ? chip(OCCASION_LABELS[h.occasion], "occasion") : null}
                                        {h.ott ? (
                                            <span className="rounded-full border border-border bg-muted px-3 py-1 text-muted-foreground">
                                                {h.ott}
                                            </span>
                                        ) : null}
                                    </div>
                                    {h.note ? (
                                        <div className="mt-2 text-sm text-foreground">
                                            {renderBody(formatNoteInline(h.note))}
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <CommentsPanel titleId={titleId} userId={userId} />
        </div>
    );
}
