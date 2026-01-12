"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, MapPin, MessageSquare, Star, Users, Loader2, X, Clock, MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import TitleSearchBox from "@/components/TitleSearchBox";
import { enqueueCreateLog, findTitleByProvider, upsertLogLocal } from "@/lib/localStore";
import { syncOutbox } from "@/lib/sync";
import { safeUUID, OCCASION_LABELS, PLACE_LABELS, STATUS_LABELS } from "@/lib/utils";
import { useRetro } from "@/context/RetroContext";
import {
    Occasion,
    Place,
    Status,
    TitleSearchItem,
    WatchLog,
    Discussion,
    Comment,
    CreateCommentRequest,
} from "@/lib/types";

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
    "CGV",
    "롯데시네마",
    "메가박스",
    "씨네Q",
] as const;

const OTT_GROUPS = [
    { label: "OTT", options: ["넷플릭스", "디즈니플러스", "티빙", "웨이브", "쿠팡플레이", "애플티비", "프라임비디오", "왓챠"] },
    { label: "유료방송", options: ["채널", "VOD"] },
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

export default function QuickLogCard({
                                         onCreated,
                                     }: {
    onCreated: (log: WatchLog) => void;
}) {
    const { isRetro } = useRetro();
    const [selected, setSelected] = useState<TitleSearchItem | null>(null);
    const [status, setStatus] = useState<Status>("IN_PROGRESS");
    const [rating, setRating] = useState<number | "">("");
    const [note, setNote] = useState("");
    const [ott, setOtt] = useState("");
    const [ottSelect, setOttSelect] = useState<string>("");
    const [customOttOptions, setCustomOttOptions] = useState<string[]>([]);
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
    const [shareToDiscussion, setShareToDiscussion] = useState(false);
    const [seasonLoading, setSeasonLoading] = useState(false);
    const [episodeLoading, setEpisodeLoading] = useState(false);
    const [seasonError, setSeasonError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const canSave = useMemo(() => !!selected && !saving, [selected, saving]);

    function toDateInput(d: Date) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    function dateToIso(date: string) {
        return new Date(`${date}T00:00:00`).toISOString();
    }

    useEffect(() => {
        if (useWatchedAt && !watchedDate) {
            setWatchedDate(toDateInput(new Date()));
        }
    }, [useWatchedAt, watchedDate]);

    useEffect(() => {
        setCustomOttOptions(loadCustomOttOptions());
    }, []);

    const allOttOptions = useMemo(() => {
        const base = Array.from(OTT_OPTIONS) as string[];
        const extras = customOttOptions.filter((v) => !base.includes(v));
        return [...base, ...extras];
    }, [customOttOptions]);

    useEffect(() => {
        if (ottSelect === OTT_CUSTOM_VALUE) return;
        setOttSelect(resolveOttSelect(ott, allOttOptions));
    }, [ott, ottSelect, allOttOptions]);

    useEffect(() => {
        let cancelled = false;

        async function loadSeasons() {
            if (!selected || selected.type !== "series") return;
            setSeasonLoading(true);
            setSeasonError(null);
            try {
                const res = await api<SeasonOption[]>(`/tmdb/tv/${selected.providerId}/seasons`);
                if (!cancelled) {
                    setSeasons(res);
                }
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
        setSelectedSeason("");
        setSelectedEpisode("");
        setSeasonPosterUrl(null);
        setSeasonYear(null);
        setSeasonError(null);

        if (selected?.type === "series") {
            loadSeasons();
        }

        return () => {
            cancelled = true;
        };
    }, [selected]);

    useEffect(() => {
        let cancelled = false;
        async function loadEpisodes() {
            if (!selected || selected.type !== "series") return;
            if (selectedSeason === "") return;
            setEpisodeLoading(true);
            try {
                const res = await api<EpisodeOption[]>(
                    `/tmdb/tv/${selected.providerId}/seasons/${selectedSeason}`
                );
                if (!cancelled) {
                    setEpisodes(res);
                }
            } catch {
                if (!cancelled) {
                    setEpisodes([]);
                }
            } finally {
                if (!cancelled) setEpisodeLoading(false);
            }
        }

        setEpisodes([]);
        setSelectedEpisode("");
        if (selectedSeason !== "") {
            const season = seasons.find((s) => s.seasonNumber === selectedSeason);
            setSeasonPosterUrl(season?.posterUrl ?? null);
            setSeasonYear(typeof season?.year === "number" ? season.year : null);
            loadEpisodes();
        } else {
            setSeasonPosterUrl(null);
            setSeasonYear(null);
        }

        return () => {
            cancelled = true;
        };
    }, [selected, selectedSeason, seasons]);

    async function submit() {
        if (!selected || saving) return;

        setSaving(true);
        try {
            const now = new Date().toISOString();
            const existingTitle = selected.titleId
                ? null
                : await findTitleByProvider(selected.provider, selected.providerId);
            const localTitleId = selected.titleId ?? existingTitle?.id ?? safeUUID();
            const localLogId = safeUUID();

            if (ott.trim()) {
                const trimmed = ott.trim();
                const baseOptions = Array.from(OTT_OPTIONS) as string[];
                if (!baseOptions.includes(trimmed) && !customOttOptions.includes(trimmed)) {
                    const next = [...customOttOptions, trimmed];
                    setCustomOttOptions(next);
                    saveCustomOttOptions(next);
                }
            }

            const pickedWatchedAt = useWatchedAt && watchedDate ? dateToIso(watchedDate) : now;
            const localLog: WatchLog = {
                id: localLogId,
                title: {
                    id: localTitleId,
                    type: selected.type,
                    name: selected.name,
                year: selected.year ?? undefined,
                    posterUrl: selected.posterUrl ?? undefined,
                    overview: selected.overview ?? undefined,
                    provider: selected.provider,
                    providerId: selected.providerId,
                    updatedAt: now,
                },
                status,
                rating: rating === "" ? null : rating,
                note: note.trim() ? note.trim() : null,
                ott: ott.trim() ? ott.trim() : null,
                seasonNumber: selectedSeason === "" ? null : selectedSeason,
                episodeNumber: selectedEpisode === "" ? null : selectedEpisode,
                seasonPosterUrl: seasonPosterUrl ?? null,
                seasonYear: seasonYear ?? null,
                spoiler: false,
                watchedAt: pickedWatchedAt,
                createdAt: now,
                place,
                occasion,
                syncStatus: "pending",
                updatedAt: now,
            };

            await upsertLogLocal(localLog);
            await enqueueCreateLog({
                logId: localLogId,
                titleId: localTitleId,
                updatedAt: now,
                log: {
                    id: localLogId,
                    op: "upsert",
                    updatedAt: now,
                    payload: {
                        titleId: localTitleId,
                        status,
                        rating: rating === "" ? null : rating,
                        note: note.trim() ? note.trim() : null,
                        ott: ott.trim() ? ott.trim() : null,
                        seasonNumber: selectedSeason === "" ? null : selectedSeason,
                        episodeNumber: selectedEpisode === "" ? null : selectedEpisode,
                        seasonPosterUrl: seasonPosterUrl ?? null,
                        seasonYear: seasonYear ?? null,
                        spoiler: false,
                        watchedAt: pickedWatchedAt,
                        place,
                        occasion,
                    },
                },
                title: {
                    id: localTitleId,
                    op: "upsert",
                    updatedAt: now,
                    payload: {
                        type: selected.type,
                        name: selected.name,
                        year: selected.year ?? null,
                        genres: null,
                        overview: selected.overview ?? null,
                        posterUrl: selected.posterUrl ?? null,
                        provider: selected.provider,
                        providerId: selected.providerId,
                    },
                },
            });
            onCreated(localLog);
            await syncOutbox();

            if (shareToDiscussion && note.trim()) {
                try {
                    const discussion = await api<Discussion>("/discussions", {
                        method: "POST",
                        body: JSON.stringify({ titleId: localTitleId }),
                    });
                    const req: CreateCommentRequest = {
                        body: note.trim(),
                        userId: null,
                        mentions: [],
                    };
                    await api<Comment>(`/discussions/${discussion.id}/comments`, {
                        method: "POST",
                        body: JSON.stringify(req),
                    });
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("sync:updated"));
                    }
                } catch {
                    // ignore share failures (e.g., offline)
                }
            }

            setToast(isRetro ? "SAVED!" : "저장되었습니다!");
            window.setTimeout(() => setToast(null), 1800);

            setSelected(null);
            setStatus("IN_PROGRESS");
            setRating("");
            setNote("");
            setOtt("");
            setOttSelect("");
            setCustomOttOptions(loadCustomOttOptions());
            setPlace("HOME");
            setOccasion("ALONE");
            setUseWatchedAt(false);
            setWatchedDate("");
            setSeasons([]);
            setEpisodes([]);
            setSelectedSeason("");
            setSelectedEpisode("");
            setSeasonPosterUrl(null);
            setSeasonYear(null);
            setShareToDiscussion(false);
        } finally {
            setSaving(false);
        }
    }

    if (isRetro) {
        return (
            <div className="relative">
                <section className="nes-container !bg-white">
                    <div className="absolute -top-4 left-4 bg-white border-2 border-black px-2 text-xs font-bold tracking-widest uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        새로운 비디오
                    </div>

                    <div className="space-y-4">
                        <TitleSearchBox onSelect={(item) => setSelected(item)} />

                        {selected ? (
                                                    <div className="border-4 border-black bg-[#212529] p-2 text-white">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-32 w-24 shrink-0 border-2 border-white bg-neutral-800 shadow-[2px_2px_0px_0px_white]">
                                                                {(seasonPosterUrl ?? selected.posterUrl) ? (
                                                                    <img
                                                                        src={seasonPosterUrl ?? selected.posterUrl ?? ""}
                                                                        alt={selected.name}
                                                                        className="h-full w-full object-cover pixelated"
                                                                        style={{ imageRendering: "pixelated" }}
                                                                        loading="lazy"
                                                                    />
                                                                ) : null}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="truncate text-lg font-bold text-yellow-400 uppercase">
                                                                    {selected.name}
                                                                </div>
                                                                <div className="mt-1 text-xs text-neutral-400">
                                                                    {selected.type === "movie" ? "영화" : "시리즈"}
                                                                    {(seasonYear ?? selected.year) ? ` · ${seasonYear ?? selected.year}` : ""}
                                                                    {selectedSeason !== "" ? ` · 시즌 ${selectedSeason}` : ""}
                                                                    {selectedEpisode !== "" ? ` · EP ${selectedEpisode}` : ""}
                                                                </div>
                                                            </div>                                    <button 
                                        onClick={() => setSelected(null)}
                                        className="h-8 w-8 flex items-center justify-center bg-red-600 text-white border-2 border-white hover:bg-red-700"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase flex items-center gap-1"><Clock className="h-3 w-3" /> 상태</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as Status)}
                                    className="w-full bg-white px-3 py-2 text-sm font-bold"
                                >
                                    {STATUS_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>

                            {selected?.type === "series" ? (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold uppercase">시즌</label>
                                        <select
                                            value={selectedSeason}
                                            onChange={(e) => setSelectedSeason(e.target.value ? Number(e.target.value) : "")}
                                            className="w-full bg-white px-3 py-2 text-sm font-bold"
                                        >
                                            <option value="">선택 안함</option>
                                            {seasons.map((s) => (
                                                <option key={s.seasonNumber} value={s.seasonNumber}>
                                                    시즌 {s.seasonNumber}{s.name ? ` · ${s.name}` : ""}
                                                </option>
                                            ))}
                                        </select>
                                        {seasonLoading ? (
                                            <div className="text-[10px] text-neutral-400">시즌 불러오는 중...</div>
                                        ) : null}
                                        {seasonError ? (
                                            <div className="text-[10px] text-red-500">{seasonError}</div>
                                        ) : null}
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold uppercase">에피소드</label>
                                        <select
                                            value={selectedEpisode}
                                            onChange={(e) => setSelectedEpisode(e.target.value ? Number(e.target.value) : "")}
                                            className="w-full bg-white px-3 py-2 text-sm font-bold"
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
                                            <div className="text-[10px] text-neutral-400">에피소드 불러오는 중...</div>
                                        ) : null}
                                    </div>
                                </>
                            ) : null}

                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase flex items-center gap-1"><Star className="h-3 w-3" /> 평점</label>
                                <select
                                    value={rating === "" ? "" : String(rating)}
                                    onChange={(e) => setRating(e.target.value === "" ? "" : Number(e.target.value))}
                                    className="w-full bg-white px-3 py-2 text-sm font-bold"
                                >
                                    <option value="">선택 안함</option>
                                    <option value="5">★★★★★ 최고!</option>
                                    <option value="3">★★★ 그럭저럭</option>
                                    <option value="1">★ 별로...</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase flex items-center gap-1"><MapPin className="h-3 w-3" /> 장소</label>
                                <select
                                    value={place}
                                    onChange={(e) => setPlace(e.target.value as Place)}
                                    className="w-full bg-white px-3 py-2 text-sm font-bold"
                                >
                                    {PLACE_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase flex items-center gap-1"><Users className="h-3 w-3" /> 누구와</label>
                                <select
                                    value={occasion}
                                    onChange={(e) => setOccasion(e.target.value as Occasion)}
                                    className="w-full bg-white px-3 py-2 text-sm font-bold"
                                >
                                    {OCCASION_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="sm:col-span-2 space-y-1">
                                <label className="text-xs font-bold uppercase flex items-center gap-1"><MonitorPlay className="h-3 w-3" /> 플랫폼</label>
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
                                    className="w-full bg-white px-3 py-2 text-sm font-bold"
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
                                        className="mt-2 w-full bg-white px-3 py-2 text-sm font-bold placeholder:text-neutral-400"
                                        placeholder="직접 입력"
                                    />
                                ) : null}
                            </div>

                            <div className="sm:col-span-2 space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setUseWatchedAt(!useWatchedAt)}
                                    className={cn(
                                        "flex items-center gap-2 text-xs font-bold uppercase",
                                        useWatchedAt ? "text-blue-600" : "text-neutral-500 hover:text-black"
                                    )}
                                >
                                    <Calendar className="h-3.5 w-3.5" />
                                    {useWatchedAt ? "날짜 직접 입력" : "오늘 보셨나요?"}
                                </button>
                                {useWatchedAt && (
                                    <input
                                        type="date"
                                        value={watchedDate}
                                        onChange={(e) => setWatchedDate(e.target.value)}
                                        className="w-full bg-white px-3 py-2 text-sm font-bold"
                                    />
                                )}
                            </div>

                            <div className="sm:col-span-2 space-y-1">
                                <label className="text-xs font-bold uppercase flex items-center gap-1"><MessageSquare className="h-3 w-3" /> 메모</label>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full min-h-[80px] bg-white px-3 py-2 text-sm font-bold placeholder:text-neutral-400 resize-none"
                                    placeholder="짧은 감상을 남겨보세요..."
                                />
                                <label className="mt-2 flex items-center gap-2 text-xs font-bold uppercase">
                                    <input
                                        type="checkbox"
                                        checked={shareToDiscussion}
                                        onChange={(e) => setShareToDiscussion(e.target.checked)}
                                    />
                                    함께 기록에 공유
                                </label>
                            </div>
                        </div>

                        <button
                            type="button"
                            disabled={!canSave}
                            onClick={submit}
                            className={cn(
                                "nes-btn is-primary w-full py-3 text-sm",
                                !canSave && "opacity-50 cursor-not-allowed bg-neutral-300 border-neutral-500 text-neutral-500"
                            )}
                        >
                            {saving ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    저장 중...
                                </span>
                            ) : (
                                "날적이 남기기"
                            )}
                        </button>
                    </div>
                </section>

                {toast ? (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-bounce">
                        <div className="border-4 border-black bg-[#f7d51d] px-4 py-2 text-sm font-bold text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            {toast}
                        </div>
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <>
            <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4 transition-all hover:border-neutral-300">
                <TitleSearchBox onSelect={(item) => setSelected(item)} />

                {selected ? (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 transition-colors">
                        <div className="flex items-center gap-5">
                            <div className="h-32 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100 shadow-sm border border-neutral-100">
                                {(seasonPosterUrl ?? selected.posterUrl) ? (
                                    <img
                                        src={seasonPosterUrl ?? selected.posterUrl ?? ""}
                                        alt={selected.name}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                    />
                                ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-base font-bold text-neutral-900">
                                    {selected.name}
                                </div>
                                <div className="mt-1 text-sm text-neutral-500 font-medium">
                                    {selected.type === "movie" ? "영화" : "시리즈"}
                                    {(seasonYear ?? selected.year) ? ` · ${seasonYear ?? selected.year}` : ""}
                                    {selectedSeason !== "" ? ` · 시즌 ${selectedSeason}` : ""}
                                    {selectedEpisode !== "" ? ` · EP ${selectedEpisode}` : ""}
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelected(null)}
                                className="rounded-full p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                        <div className="text-xs font-medium text-neutral-500 ml-1 flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            상태
                        </div>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as Status)}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none"
                        >
                            {STATUS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>

                    {selected?.type === "series" ? (
                        <>
                            <div className="space-y-1.5">
                                <div className="text-xs font-medium text-neutral-500 ml-1">시즌</div>
                                <select
                                    value={selectedSeason}
                                    onChange={(e) => setSelectedSeason(e.target.value ? Number(e.target.value) : "")}
                                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none"
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
                            </div>

                            <div className="space-y-1.5">
                                <div className="text-xs font-medium text-neutral-500 ml-1">에피소드</div>
                                <select
                                    value={selectedEpisode}
                                    onChange={(e) => setSelectedEpisode(e.target.value ? Number(e.target.value) : "")}
                                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none"
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
                            </div>
                        </>
                    ) : null}

                    <div className="space-y-1.5">
                        <div className="text-xs font-medium text-neutral-500 ml-1 flex items-center gap-1.5">
                            <Star className="h-3 w-3" />
                            평점
                        </div>
                        <select
                            value={rating === "" ? "" : String(rating)}
                            onChange={(e) => setRating(e.target.value === "" ? "" : Number(e.target.value))}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none"
                        >
                            <option value="">선택 안함</option>
                            <option value="5">😍 최고예요</option>
                            <option value="3">🙂 볼만해요</option>
                            <option value="1">😕 아쉬워요</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <div className="text-xs font-medium text-neutral-500 ml-1 flex items-center gap-1.5">
                            <MapPin className="h-3 w-3" />
                            장소
                        </div>
                        <select
                            value={place}
                            onChange={(e) => setPlace(e.target.value as Place)}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none"
                        >
                            {PLACE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <div className="text-xs font-medium text-neutral-500 ml-1 flex items-center gap-1.5">
                            <Users className="h-3 w-3" />
                            누구와
                        </div>
                        <select
                            value={occasion}
                            onChange={(e) => setOccasion(e.target.value as Occasion)}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none"
                        >
                            {OCCASION_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-2 space-y-1.5">
                        <div className="text-xs font-medium text-neutral-500 ml-1 flex items-center gap-1.5">
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
                            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none"
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
                                className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none"
                                placeholder="직접 입력"
                            />
                        ) : null}
                    </div>

                    <div className="md:col-span-2 space-y-2">
                        <button
                            type="button"
                            onClick={() => setUseWatchedAt(!useWatchedAt)}
                            className={cn(
                                "flex items-center gap-2 text-xs font-medium transition-colors",
                                useWatchedAt ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-600"
                            )}
                        >
                            <Calendar className="h-3.5 w-3.5" />
                            {useWatchedAt ? "날짜 직접 선택 중" : "오늘 보셨나요?"}
                        </button>
                        {useWatchedAt ? (
                            <input
                                type="date"
                                value={watchedDate}
                                onChange={(e) => setWatchedDate(e.target.value)}
                                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none"
                            />
                        ) : null}
                    </div>

                    <div className="md:col-span-2 space-y-1.5">
                        <div className="text-xs font-medium text-neutral-500 ml-1 flex items-center gap-1.5">
                            <MessageSquare className="h-3 w-3" />
                            메모
                        </div>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none resize-none"
                            placeholder="짧은 감상을 남겨보세요."
                            rows={3}
                        />
                        <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
                            <input
                                type="checkbox"
                                checked={shareToDiscussion}
                                onChange={(e) => setShareToDiscussion(e.target.checked)}
                            />
                            함께 기록에 공유
                        </label>
                    </div>
                </div>

                <button
                    type="button"
                    disabled={!canSave}
                    onClick={submit}
                    className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-neutral-800 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                >
                    {saving ? "저장 중..." : "기록 저장"}
                </button>
            </section>

            {toast ? (
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4">
                    <div className="rounded-full bg-neutral-900 px-6 py-2 text-sm text-white shadow-lg">
                        {toast}
                    </div>
                </div>
            ) : null}
        </>
    );
}
