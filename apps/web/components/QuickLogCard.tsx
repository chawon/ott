"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, MapPin, MessageSquare, Star, Users, Loader2, X, Clock, MonitorPlay, ArrowRight, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import TitleSearchBox from "@/components/TitleSearchBox";
import { enqueueCreateLog, findTitleByProvider, upsertLogLocal, countLogsLocal } from "@/lib/localStore";
import { syncOutbox } from "@/lib/sync";
import { safeUUID, OCCASION_LABELS, placeOptionsForType, ratingOptionsForType, statusOptionsForType, tmdbResize } from "@/lib/utils";
import { useRetro } from "@/context/RetroContext";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import {
    Occasion,
    Place,
    Status,
    Title,
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

const OCCASION_OPTIONS: { value: Occasion; label: string }[] = (Object.keys(OCCASION_LABELS) as Occasion[])
    .map((value) => ({ value, label: OCCASION_LABELS[value] }));

const RETRO_VIDEO_RATING_OPTIONS = [
    { value: 5, label: "★★★★★ 최고!" },
    { value: 3, label: "★★★ 그럭저럭" },
    { value: 1, label: "★ 별로..." },
];

const RETRO_BOOK_RATING_OPTIONS = [
    { value: 5, label: "★★★★★ 인생책" },
    { value: 3, label: "★★★ 무난해요" },
    { value: 1, label: "★ 아쉬워요" },
];

const VIDEO_PLATFORM_OPTIONS = [
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

const VIDEO_PLATFORM_GROUPS = [
    { label: "OTT", options: ["넷플릭스", "디즈니플러스", "티빙", "웨이브", "쿠팡플레이", "애플티비", "프라임비디오", "왓챠"] },
    { label: "유료 방송", options: ["채널", "VOD"] },
    { label: "물리 매체", options: ["DVD", "블루레이"] },
    { label: "극장", options: ["CGV", "롯데시네마", "메가박스", "씨네Q"] },
] as const;

const BOOK_PLATFORM_GROUPS = [
    { label: "서점", options: ["교보문고", "영풍문고", "예스24", "알라딘"] },
    { label: "전자책", options: ["리디", "밀리의서재", "윌라", "플레이북"] },
    { label: "도서관", options: ["공공도서관", "대학도서관", "학교도서관"] },
] as const;

const BOOK_PLATFORM_OPTIONS = BOOK_PLATFORM_GROUPS.flatMap((group) => group.options);

const OTT_CUSTOM_VALUE = "__custom__";
const VIDEO_CUSTOM_KEY = "watchlog.ott.custom";
const BOOK_CUSTOM_KEY = "watchlog.book.platform.custom";

function resolvePlatformSelect(
    value: string,
    options: string[],
    groups: readonly { label: string; options: readonly string[] }[]
) {
    if (!value) return "";
    if (value.includes(",")) {
        const picked = value.split(",").map((v) => v.trim()).filter(Boolean);
        for (const group of groups) {
            if (picked.length !== group.options.length) continue;
            const allMatch = picked.every((v) => (group.options as readonly string[]).includes(v));
            if (allMatch) return `__group:${group.label}`;
        }
        return OTT_CUSTOM_VALUE;
    }
    return options.includes(value) ? value : OTT_CUSTOM_VALUE;
}

function loadCustomOptions(key: string): string[] {
    if (typeof localStorage === "undefined") return [];
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((v) => typeof v === "string" && v.trim().length > 0);
    } catch {
        return [];
    }
}

function saveCustomOptions(key: string, options: string[]) {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(options));
}

function titleTypeLabel(type: Title["type"]) {
    return type === "movie" ? "영화" : type === "series" ? "시리즈" : "책";
}

function bookMeta(item: Pick<TitleSearchItem, "author" | "publisher" | "year">) {
    return [item.author, item.publisher, item.year ? String(item.year) : null]
        .filter(Boolean)
        .join(" · ");
}

export default function QuickLogCard({
                                         onCreated,
                                         onContentTypeChange,
                                         initialContentType = "video",
                                         initialSearchQuery,
                                         initialPlatform,
                                     }: {
    onCreated: (log: WatchLog, options?: { shareCard: boolean }) => void;
    onContentTypeChange?: (type: "video" | "book") => void;
    initialContentType?: "video" | "book";
    initialSearchQuery?: string;
    initialPlatform?: string;
}) {
    const { isRetro } = useRetro();
    const [contentType, setContentType] = useState<"video" | "book">(initialContentType);
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
    const [shareCard, setShareCard] = useState(false);
    const [seasonLoading, setSeasonLoading] = useState(false);
    const [episodeLoading, setEpisodeLoading] = useState(false);
    const [seasonError, setSeasonError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [banner, setBanner] = useState<{ visible: boolean; count: number } | null>(null);

    const isBookMode = contentType === "book";
    const platformOptions = isBookMode ? BOOK_PLATFORM_OPTIONS : VIDEO_PLATFORM_OPTIONS;
    const platformGroups = isBookMode ? BOOK_PLATFORM_GROUPS : VIDEO_PLATFORM_GROUPS;
    const platformCustomKey = isBookMode ? BOOK_CUSTOM_KEY : VIDEO_CUSTOM_KEY;
    const platformPlaceholder = isBookMode
        ? "예: 교보문고, 리디, 공공도서관"
        : "직접 입력";
    const canSave = useMemo(() => !!selected && !saving, [selected, saving]);
    const isWishlist = status === "WISHLIST";
    const statusOptions = useMemo(
        () => statusOptionsForType(isBookMode ? "book" : "movie"),
        [isBookMode]
    );
    const placeOptions = useMemo(
        () => placeOptionsForType(isBookMode ? "book" : "movie"),
        [isBookMode]
    );
    const ratingOptions = isRetro
        ? (isBookMode ? RETRO_BOOK_RATING_OPTIONS : RETRO_VIDEO_RATING_OPTIONS)
        : ratingOptionsForType(isBookMode ? "book" : "movie");

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
        if (!selected || selected.provider !== "LOCAL" || !selected.titleId) return;
        let cancelled = false;
        (async () => {
            try {
                const title = await api<Title>(`/titles/${selected.titleId}`);
                if (cancelled) return;
                setSelected((prev) => {
                    if (!prev || prev.titleId !== selected.titleId) return prev;
                    return {
                        ...prev,
                        provider: title.provider ?? prev.provider,
                        providerId: title.providerId ?? prev.providerId,
                        posterUrl: title.posterUrl ?? prev.posterUrl,
                        year: title.year ?? prev.year,
                        type: title.type ?? prev.type,
                        name: title.name ?? prev.name,
                    };
                });
            } catch {
                // ignore resolution errors
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selected?.provider, selected?.titleId]);

    useEffect(() => {
        setCustomOttOptions(loadCustomOptions(platformCustomKey));
    }, [platformCustomKey]);

    useEffect(() => {
        setContentType(initialContentType);
    }, [initialContentType]);

    useEffect(() => {
        if (onContentTypeChange) onContentTypeChange(contentType);
    }, [contentType, onContentTypeChange]);

    useEffect(() => {
        setSelected(null);
        setSeasons([]);
        setEpisodes([]);
        setSelectedSeason("");
        setSelectedEpisode("");
        setSeasonPosterUrl(null);
        setSeasonYear(null);
    }, [contentType]);

    const allOttOptions = useMemo(() => {
        const base = Array.from(platformOptions) as string[];
        const extras = customOttOptions.filter((v) => !base.includes(v));
        return [...base, ...extras];
    }, [customOttOptions, platformOptions]);

    useEffect(() => {
        if (ottSelect === OTT_CUSTOM_VALUE) return;
        setOttSelect(resolvePlatformSelect(ott, allOttOptions, platformGroups));
    }, [ott, ottSelect, allOttOptions, platformGroups]);

    useEffect(() => {
        if (isBookMode) return;
        const next = initialPlatform?.trim();
        if (!next) return;
        setOtt(next);
    }, [initialPlatform, isBookMode]);

    useEffect(() => {
        let cancelled = false;

        async function loadSeasons() {
            if (!selected || selected.type !== "series") return;
            if (!selected.providerId || selected.provider === "LOCAL") return;
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
            if (!selected.providerId || selected.provider === "LOCAL") return;
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
                const baseOptions = Array.from(platformOptions) as string[];
                if (!baseOptions.includes(trimmed) && !customOttOptions.includes(trimmed)) {
                    const next = [...customOttOptions, trimmed];
                    setCustomOttOptions(next);
                    saveCustomOptions(platformCustomKey, next);
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
                    author: selected.author ?? undefined,
                    publisher: selected.publisher ?? undefined,
                    isbn10: selected.isbn10 ?? undefined,
                    isbn13: selected.isbn13 ?? undefined,
                    pubdate: selected.pubdate ?? undefined,
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
                origin: "LOG",
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
                        origin: "LOG",
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
                        author: selected.author ?? null,
                        publisher: selected.publisher ?? null,
                        isbn10: selected.isbn10 ?? null,
                        isbn13: selected.isbn13 ?? null,
                        pubdate: selected.pubdate ?? null,
                        provider: selected.provider,
                        providerId: selected.providerId,
                    },
                },
            });
            await trackEvent("log_create", {
                titleType: selected.type,
                hasRating: rating !== "",
                hasNote: note.trim().length > 0,
                hasOtt: ott.trim().length > 0,
            });
            onCreated(localLog, { shareCard });
            await syncOutbox();

            if (shareToDiscussion) {
                try {
                    const discussion = await api<Discussion>("/discussions", {
                        method: "POST",
                        body: JSON.stringify({ titleId: localTitleId }),
                    });
                    if (note.trim()) {
                        const userId =
                            typeof localStorage !== "undefined" ? localStorage.getItem("watchlog.userId") : null;
                        const req: CreateCommentRequest = {
                            body: note.trim(),
                            userId: userId ?? null,
                            mentions: [],
                            syncLog: false,
                        };
                        await api<Comment>(`/discussions/${discussion.id}/comments`, {
                            method: "POST",
                            body: JSON.stringify(req),
                        });
                    }
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("sync:updated"));
                    }
                } catch {
                    // ignore share failures (e.g., offline)
                }
            }

            const totalCount = await countLogsLocal();
            setBanner({ visible: true, count: totalCount });
            window.setTimeout(() => setBanner(null), 3000);

            setSelected(null);
            setStatus("IN_PROGRESS");
            setRating("");
            setNote("");
            setOtt("");
            setOttSelect("");
            setCustomOttOptions(loadCustomOptions(platformCustomKey));
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
            setShareCard(false);
            setShareToDiscussion(false);
        } finally {
            setSaving(false);
        }
    }

    if (isRetro) {
        return (
            <div className="relative">
                <section className={cn(
                    "nes-container !bg-white",
                    isBookMode && "!bg-[#f1fff2] !border-[#2ecc71]"
                )}>
                    <div className="absolute -top-4 left-4 bg-white border-2 border-black px-2 text-xs font-bold tracking-wide shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        {contentType === "book" ? "새로운 책" : "새로운 비디오"}
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2" data-onboarding-target="content-type">
                            <button
                                type="button"
                                onClick={() => {
                                    setContentType("video");
                                }}
                                className={cn(
                                    "nes-btn !px-3 !py-1 text-xs",
                                    contentType === "video" ? "is-primary" : "",
                                    contentType === "book" && "is-success"
                                )}
                            >
                                영상
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setContentType("book");
                                }}
                                className={cn(
                                    "nes-btn !px-3 !py-1 text-xs",
                                    contentType === "book" ? "is-primary" : "",
                                    contentType === "book" && "is-success"
                                )}
                            >
                                책
                            </button>
                        </div>

                        <div
                            data-onboarding-target="title-search"
                            className="rounded-md border-4 border-black bg-yellow-100 p-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                        >
                            <div className="mb-1 text-sm font-bold text-black">여기부터 시작: 작품 검색</div>
                            <TitleSearchBox
                                key={contentType}
                                onSelect={(item) => setSelected(item)}
                                placeholder={isBookMode ? "책 검색 (어린 왕자, 불편한 편의점...)" : "작품 검색 (듄, 더 베어...)"}
                                showRecentDiscussions
                                contentType={isBookMode ? "book" : "video"}
                                initialQuery={initialSearchQuery}
                            />
                        </div>

                        {selected ? (
                                                    <div className="border-4 border-black bg-[#212529] p-2 text-white" data-onboarding-target="selected-title">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-32 w-24 shrink-0 border-2 border-white bg-neutral-800 shadow-[2px_2px_0px_0px_white]">
                                                                {(seasonPosterUrl ?? selected.posterUrl) ? (
                                                                    <img
                                                                        src={tmdbResize(seasonPosterUrl ?? selected.posterUrl, "w185") ?? seasonPosterUrl ?? selected.posterUrl ?? ""}
                                                                        alt={selected.name}
                                                                        className="h-full w-full object-cover pixelated"
                                                                        style={{ imageRendering: "pixelated" }}
                                                                        loading="lazy"
                                                                    />
                                                                ) : null}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="truncate text-lg font-bold text-yellow-400">
                                                                    {selected.name}
                                                                </div>
                                                                <div className="mt-1 text-xs text-neutral-400">
                                                                    {titleTypeLabel(selected.type)}
                                                                    {selected.type === "book" ? (
                                                                        bookMeta(selected) ? ` · ${bookMeta(selected)}` : ""
                                                                    ) : (
                                                                        <>
                                                                            {(seasonYear ?? selected.year) ? ` · ${seasonYear ?? selected.year}` : ""}
                                                                            {selectedSeason !== "" ? ` · 시즌 ${selectedSeason}` : ""}
                                                                            {selectedEpisode !== "" ? ` · EP ${selectedEpisode}` : ""}
                                                                        </>
                                                                    )}
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
                                <label className="text-sm font-bold flex items-center gap-1"><Clock className="h-3 w-3" /> 상태</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as Status)}
                                    className="w-full bg-white px-3 py-2 text-sm font-bold"
                                >
                                    {statusOptions.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>

                            {selected?.type === "series" ? (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-sm font-bold">시즌</label>
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
                                            <div className="text-xs text-neutral-500">시즌 불러오는 중...</div>
                                        ) : null}
                                        {seasonError ? (
                                            <div className="text-xs text-red-600">{seasonError}</div>
                                        ) : null}
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-sm font-bold">에피소드</label>
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
                                            <div className="text-xs text-neutral-500">에피소드 불러오는 중...</div>
                                        ) : null}
                                    </div>
                                </>
                            ) : null}

                            <div className="space-y-1">
                                <label className="text-sm font-bold flex items-center gap-1"><Star className="h-3 w-3" /> 평점</label>
                                <select
                                    value={rating === "" ? "" : String(rating)}
                                    onChange={(e) => setRating(e.target.value === "" ? "" : Number(e.target.value))}
                                    className={cn(
                                        "w-full bg-white px-3 py-2 text-sm font-bold",
                                        isWishlist && "opacity-50 cursor-not-allowed"
                                    )}
                                    disabled={isWishlist}
                                >
                                    <option value="">선택 안함</option>
                                    {ratingOptions.map((o) => (
                                        <option key={o.value} value={String(o.value)}>{o.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-bold flex items-center gap-1"><MapPin className="h-3 w-3" /> 장소</label>
                                <select
                                    value={place}
                                    onChange={(e) => setPlace(e.target.value as Place)}
                                    className={cn(
                                        "w-full bg-white px-3 py-2 text-sm font-bold",
                                        isWishlist && "opacity-50 cursor-not-allowed"
                                    )}
                                    disabled={isWishlist}
                                >
                                    {placeOptions.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-bold flex items-center gap-1"><Users className="h-3 w-3" /> 누구와</label>
                                <select
                                    value={occasion}
                                    onChange={(e) => setOccasion(e.target.value as Occasion)}
                                    className={cn(
                                        "w-full bg-white px-3 py-2 text-sm font-bold",
                                        isWishlist && "opacity-50 cursor-not-allowed"
                                    )}
                                    disabled={isWishlist}
                                >
                                    {OCCASION_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="sm:col-span-2 space-y-1">
                                <label className="text-sm font-bold flex items-center gap-1"><MonitorPlay className="h-3 w-3" /> 플랫폼</label>
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
                                    {platformGroups.map((g) => (
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
                                        placeholder={platformPlaceholder}
                                    />
                                ) : null}
                            </div>

                            <div className="sm:col-span-2 space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setUseWatchedAt(!useWatchedAt)}
                                    className={cn(
                                        "flex items-center gap-2 text-sm font-bold",
                                        useWatchedAt ? "text-blue-600" : "text-neutral-500 hover:text-black"
                                    )}
                                >
                                    <Calendar className="h-3.5 w-3.5" />
                                    {useWatchedAt ? "날짜 직접 입력" : "다른 날짜로 기록하기"}
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
                                <label className="text-sm font-bold flex items-center gap-1"><MessageSquare className="h-3 w-3" /> 메모</label>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full min-h-[80px] bg-white px-3 py-2 text-sm font-bold placeholder:text-neutral-400 resize-none"
                                    placeholder="짧은 감상을 남겨보세요..."
                                />
                            </div>
                        </div>

                        <div
                            className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
                            data-onboarding-target="status-save"
                        >
                            <div className="space-y-1">
                                <div className="text-xs font-bold text-neutral-800 flex items-center gap-1">
                                    <Share2 className="h-3 w-3" />
                                    저장 후 함께 하기
                                </div>
                                <div className="flex flex-wrap items-center gap-4">
                                    <label className="flex items-center gap-2 text-sm font-bold whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={shareToDiscussion}
                                            onChange={(e) => setShareToDiscussion(e.target.checked)}
                                            className="h-5 w-5"
                                        />
                                        함께 하는 기록 남기기
                                    </label>
                                    <label className="flex items-center gap-2 text-sm font-bold whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={shareCard}
                                            onChange={(e) => setShareCard(e.target.checked)}
                                            className="h-5 w-5"
                                        />
                                        공유 이미지 카드 만들기
                                    </label>
                                </div>
                            </div>

                            <button
                                type="button"
                                disabled={!canSave}
                                onClick={submit}
                                className={cn(
                                    "nes-btn is-primary h-[38px] px-5 text-sm whitespace-nowrap",
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
                    </div>
                </section>

                {banner && banner.visible ? (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-bounce">
                        <div className="border-4 border-black bg-[#f7d51d] p-4 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-4">
                            <div className="text-sm font-bold">
                                좋아요! {banner.count}번째 타임라인이 쌓였어요.
                            </div>
                            <Link
                                href="/timeline"
                                data-onboarding-target="timeline-confirm"
                                className="flex-shrink-0 border-2 border-black bg-white px-2 py-1 text-xs font-bold hover:bg-neutral-100"
                            >
                                타임라인 보기
                            </Link>
                        </div>
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <>
            <section className={cn(
                "rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm space-y-4 transition-all hover:border-border/80",
                isBookMode && "bg-emerald-50/30 ring-1 ring-emerald-100/80 border-emerald-200/70 dark:bg-emerald-950/25 dark:ring-emerald-900/60 dark:border-emerald-900/50"
            )}>
                <div className="flex items-center gap-2" data-onboarding-target="content-type">
                    <button
                        type="button"
                        onClick={() => {
                            setContentType("video");
                        }}
                        className={cn(
                            "rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
                            contentType === "video" ? "bg-neutral-900 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80",
                            contentType === "book" && "border border-emerald-200/70 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-50"
                        )}
                    >
                        영상
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setContentType("book");
                        }}
                        className={cn(
                            "rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
                            contentType === "book" ? "bg-neutral-900 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80",
                            contentType === "book" && "border border-emerald-200/70 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-50"
                        )}
                    >
                        책
                    </button>
                </div>

                <div
                    data-onboarding-target="title-search"
                    className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 ring-2 ring-blue-100 shadow-sm"
                >
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
                        <ArrowRight className="h-4 w-4" />
                        먼저 작품을 검색해 보세요
                    </div>
                    <TitleSearchBox
                        key={contentType}
                        onSelect={(item) => setSelected(item)}
                        placeholder={isBookMode ? "책 검색 (어린 왕자, 불편한 편의점...)" : "작품 검색 (예: 듄, 더 베어)"}
                        showRecentDiscussions
                        contentType={isBookMode ? "book" : "video"}
                        initialQuery={initialSearchQuery}
                    />
                </div>

                {selected ? (
                    <div className="rounded-xl border border-border bg-muted p-4 transition-colors" data-onboarding-target="selected-title">
                        <div className="flex items-center gap-5">
                            <div className="h-32 w-20 shrink-0 overflow-hidden rounded-lg bg-muted shadow-sm border border-border">
                                {(seasonPosterUrl ?? selected.posterUrl) ? (
                                    <img
                                        src={tmdbResize(seasonPosterUrl ?? selected.posterUrl, "w185") ?? seasonPosterUrl ?? selected.posterUrl ?? ""}
                                        alt={selected.name}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                    />
                                ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-base font-bold text-foreground">
                                    {selected.name}
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground font-medium">
                                    {titleTypeLabel(selected.type)}
                                    {selected.type === "book" ? (
                                        bookMeta(selected) ? ` · ${bookMeta(selected)}` : ""
                                    ) : (
                                        <>
                                            {(seasonYear ?? selected.year) ? ` · ${seasonYear ?? selected.year}` : ""}
                                            {selectedSeason !== "" ? ` · 시즌 ${selectedSeason}` : ""}
                                            {selectedEpisode !== "" ? ` · EP ${selectedEpisode}` : ""}
                                        </>
                                    )}
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelected(null)}
                                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
                            className="w-full select-base rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none"
                        >
                            {statusOptions.map((o) => (
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
                                    className="w-full select-base rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none"
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
                                    className="w-full select-base rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none"
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
                            className={cn(
                                "w-full select-base rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none",
                                isWishlist && "opacity-50 cursor-not-allowed"
                            )}
                            disabled={isWishlist}
                        >
                            <option value="">선택 안함</option>
                            {ratingOptions.map((o) => (
                                <option key={o.value} value={String(o.value)}>{o.label}</option>
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
                            className="w-full select-base rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none"
                        >
                            <option value="">선택 안함</option>
                            {platformGroups.map((g) => (
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
                                className="mt-2 w-full select-base rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none"
                                placeholder={platformPlaceholder}
                            />
                        ) : null}
                    </div>

                    <>
                            <div className="space-y-1.5">
                                <div className="text-xs font-medium text-neutral-500 ml-1 flex items-center gap-1.5">
                                    <MapPin className="h-3 w-3" />
                                    장소
                                </div>
                                <select
                                    value={place}
                                    onChange={(e) => setPlace(e.target.value as Place)}
                                    className={cn(
                                        "w-full select-base rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none",
                                        isWishlist && "opacity-50 cursor-not-allowed"
                                    )}
                                    disabled={isWishlist}
                                >
                                    {placeOptions.map((o) => (
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
                                    className={cn(
                                        "w-full select-base rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none",
                                        isWishlist && "opacity-50 cursor-not-allowed"
                                    )}
                                    disabled={isWishlist}
                                >
                                    {OCCASION_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
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
                                    {useWatchedAt ? "날짜 직접 선택 중" : "다른 날짜로 기록하기"}
                                </button>
                                {useWatchedAt ? (
                                    <input
                                        type="date"
                                        value={watchedDate}
                                        onChange={(e) => setWatchedDate(e.target.value)}
                                        className="w-full select-base rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none"
                                    />
                                ) : null}
                            </div>
                    </>

                    <div className="md:col-span-2 space-y-1.5">
                        <div className="text-xs font-medium text-neutral-500 ml-1 flex items-center gap-1.5">
                            <MessageSquare className="h-3 w-3" />
                            메모
                        </div>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full select-base rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900/5 transition-all outline-none resize-none"
                            placeholder="짧은 감상을 남겨보세요."
                            rows={3}
                        />
                    </div>
                </div>

                <div
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
                    data-onboarding-target="status-save"
                >
                    <div className="space-y-1">
                        <div className="text-xs font-medium text-neutral-500 ml-1 flex items-center gap-1.5">
                            <Share2 className="h-3 w-3" />
                            저장 후 함께 하기
                        </div>
                        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-muted/30 px-3 py-2">
                            <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 whitespace-nowrap">
                                <input
                                    type="checkbox"
                                    checked={shareToDiscussion}
                                    onChange={(e) => setShareToDiscussion(e.target.checked)}
                                    className="h-5 w-5"
                                />
                                함께 하는 기록 남기기
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 whitespace-nowrap">
                                <input
                                    type="checkbox"
                                    checked={shareCard}
                                    onChange={(e) => setShareCard(e.target.checked)}
                                    className="h-5 w-5"
                                />
                                공유 이미지 카드 만들기
                            </label>
                        </div>
                    </div>

                    <button
                        type="button"
                        disabled={!canSave}
                        onClick={submit}
                        className="h-[40px] rounded-2xl bg-neutral-900 px-5 text-sm font-semibold text-white transition-all hover:bg-neutral-800 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                    >
                        {saving ? "저장 중..." : "기록 저장"}
                    </button>
                </div>
            </section>

            {banner && banner.visible ? (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card/90 p-4 shadow-xl backdrop-blur-md">
                        <div className="text-sm font-medium text-foreground">
                            좋아요, <span className="font-bold text-blue-600">{banner.count}</span>번째 타임라인이 쌓였어요.
                        </div>
                        <Link
                            href="/timeline"
                            data-onboarding-target="timeline-confirm"
                            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                        >
                            타임라인 보기 <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                </div>
            ) : null}
        </>
    );
}
