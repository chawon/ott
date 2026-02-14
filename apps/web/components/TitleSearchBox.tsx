"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { DiscussionListItem, TitleSearchItem } from "@/lib/types";
import { useRetro } from "@/context/RetroContext";
import { cn, tmdbResize } from "@/lib/utils";

export default function TitleSearchBox({
                                           onSelect,
                                           placeholder = "작품 검색 (예: 듄, 더 베어)",
                                           showRecentDiscussions = true,
                                           contentType = "video",
                                       }: {
    onSelect: (item: TitleSearchItem) => void;
    placeholder?: string;
    showRecentDiscussions?: boolean;
    contentType?: "video" | "book";
}) {
    const { isRetro } = useRetro();
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<TitleSearchItem[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [recent, setRecent] = useState<DiscussionListItem[]>([]);
    const [recentLoading, setRecentLoading] = useState(false);
    const [recentErr, setRecentErr] = useState<string | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);

    const query = useMemo(() => q.trim(), [q]);

    useEffect(() => {
        if (!open) return;

        if (!query) {
            setItems([]);
            setErr(null);
            setLoading(false);
            return;
        }

        let cancelled = false;

        const t = setTimeout(async () => {
            setLoading(true);
            setErr(null);

            try {
                const typeQuery = contentType === "book" ? "&type=book" : "";
                const res = await api<TitleSearchItem[]>(
                    `/titles/search?q=${encodeURIComponent(query)}${typeQuery}`
                );
                if (!cancelled) setItems(res);
            } catch (e: any) {
                if (!cancelled) {
                    setItems([]);
                    setErr(e?.message ?? "Search failed");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [query, open, contentType]);

    useEffect(() => {
        if (!open || !showRecentDiscussions) return;
        if (query) return;
        let cancelled = false;

        (async () => {
            setRecentLoading(true);
            setRecentErr(null);
            try {
                const res = await api<DiscussionListItem[]>("/discussions/latest?limit=6&days=14");
                if (!cancelled) setRecent(res);
            } catch (e: any) {
                if (!cancelled) {
                    setRecent([]);
                    setRecentErr(e?.message ?? "Failed to load discussions");
                }
            } finally {
                if (!cancelled) setRecentLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [open, query, showRecentDiscussions]);

    useEffect(() => {
        if (!open) return;

        function onPointerDown(e: MouseEvent | TouchEvent) {
            const root = rootRef.current;
            if (!root) return;
            if (e.target instanceof Node && root.contains(e.target)) return;
            setOpen(false);
        }

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("touchstart", onPointerDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("touchstart", onPointerDown);
        };
    }, [open]);

    function pick(item: TitleSearchItem) {
        onSelect(item);
        setQ("");
        setOpen(false);
        setItems([]);
        setErr(null);
        setActiveIndex(0);
    }

    const filteredRecent = useMemo(() => {
        if (contentType === "book") return recent.filter((d) => d.titleType === "book");
        return recent.filter((d) => d.titleType === "movie" || d.titleType === "series");
    }, [contentType, recent]);

    const showRecentPanel = showRecentDiscussions && !query && (recentLoading || recentErr || filteredRecent.length > 0);
    const showPanel = open && (loading || err || items.length > 0 || showRecentPanel);

    useEffect(() => {
        setActiveIndex(0);
    }, [items]);

    const retroPlaceholder =
        contentType === "book"
            ? "책을 검색하세요 (어린 왕자, 불편한 편의점...)"
            : "비디오를 검색하세요 (터미네이터, 투캅스...)";

    return (
        <div ref={rootRef} className="relative">
            <input
                value={q}
                onChange={(e) => {
                    setQ(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => {
                    setOpen(true);
                }}
                onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        setOpen(false);
                        return;
                    }
                    if (e.key === "ArrowDown" && items.length > 0) {
                        e.preventDefault();
                        setActiveIndex((i) => (i + 1) % items.length);
                    }
                    if (e.key === "ArrowUp" && items.length > 0) {
                        e.preventDefault();
                        setActiveIndex((i) => (i - 1 + items.length) % items.length);
                    }
                    if (e.key === "Enter" && items.length > 0) {
                        pick(items[Math.max(0, Math.min(activeIndex, items.length - 1))]);
                    }
                }}
                placeholder={isRetro ? retroPlaceholder : placeholder}
                className={cn(
                    "w-full transition-all outline-none",
                    isRetro 
                        ? "border-4 border-black bg-white px-4 py-3 text-base font-semibold shadow-[inset_4px_4px_0px_0px_#e0e0e0] focus:ring-4 focus:ring-yellow-400 focus:border-black placeholder:text-neutral-600"
                        : "rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:ring-2 focus:ring-ring/40 focus:border-border placeholder:text-muted-foreground"
                )}
            />

            {showPanel && (
                <div className={cn(
                    "absolute z-50 mt-2 w-full max-h-[70vh] overflow-auto bg-card text-card-foreground",
                    isRetro 
                        ? "border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" 
                        : "rounded-xl border border-border shadow-xl"
                )} data-onboarding-target="title-search-panel">
                    {showRecentPanel ? (
                        <div className={cn(isRetro ? "border-b-4 border-black" : "border-b border-border")}>
                            <div className={cn(
                                "px-4 py-2 text-[10px] font-bold uppercase tracking-widest",
                                isRetro ? "bg-black text-white" : "text-muted-foreground"
                            )}>
                                {isRetro
                                    ? contentType === "book"
                                        ? "요즘 수다 떠는 책들"
                                        : "요즘 수다 떠는 영상들"
                                    : "요즘 함께 하는 작품들"}
                            </div>
                            {recentLoading ? (
                                <div className="px-4 py-3 text-sm font-bold">불러오는 중...</div>
                            ) : null}
                            {!recentLoading && recentErr ? (
                                <div className="px-4 py-3 text-sm text-red-600 font-bold">{recentErr}</div>
                            ) : null}
                            {!recentLoading && !recentErr && recent.length === 0 ? (
                                <div className="px-4 py-3 text-sm font-bold text-muted-foreground">아직 없어요</div>
                            ) : null}
                            {!recentLoading &&
                                !recentErr &&
                                filteredRecent.map((d) => {
                                    const typeLabel =
                                        d.titleType === "movie" ? "영화" : d.titleType === "series" ? "시리즈" : "책";
                                    const meta = `${typeLabel}${d.titleYear ? ` · ${d.titleYear}` : ""}`;
                                    const item: TitleSearchItem = {
                                        provider: "LOCAL",
                                        providerId: d.titleId,
                                        titleId: d.titleId,
                                        type: d.titleType,
                                        name: d.titleName,
                                        year: d.titleYear ?? undefined,
                                        posterUrl: d.posterUrl ?? undefined,
                                    };

                                    return (
                                        <button
                                            key={d.id}
                                            type="button"
                                            onClick={() => pick(item)}
                                            className={cn(
                                                "flex w-full items-center gap-4 px-4 py-3 text-left transition-colors",
                                                isRetro ? "border-b-2 border-black hover:bg-yellow-100 last:border-b-0" : "hover:bg-muted"
                                            )}
                                        >
                                            <div className={cn(
                                                "h-20 w-14 shrink-0 overflow-hidden bg-muted",
                                                isRetro ? "border-2 border-black" : "rounded-lg shadow-sm border border-border"
                                            )}>
                                                {d.posterUrl ? (
                                                    <img
                                                        src={tmdbResize(d.posterUrl, "w185") ?? d.posterUrl}
                                                        alt={d.titleName}
                                                        className={cn("h-full w-full object-cover", isRetro && "pixelated")}
                                                        style={isRetro ? { imageRendering: "pixelated" } : {}}
                                                        loading="lazy"
                                                    />
                                                ) : null}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className={cn("truncate text-sm font-bold uppercase", !isRetro && "normal-case")}>
                                                    {d.titleName}
                                                </div>
                                                <div className={cn("mt-0.5", isRetro ? "text-xs font-semibold text-neutral-700" : "text-[10px] font-bold text-muted-foreground")}>{meta}</div>
                                                <div className={cn("mt-1 text-xs font-semibold", isRetro ? "text-blue-700" : "text-muted-foreground")}>
                                                    댓글 {d.commentCount}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                        </div>
                    ) : null}

                    {loading && (
                        <div className="px-4 py-3 text-sm font-bold">검색 중...</div>
                    )}

                    {!loading && err && (
                        <div className="px-4 py-3 text-sm text-red-600 font-bold">{err}</div>
                    )}

                    {!loading &&
                        !err &&
                        items.map((t, idx) => {
                            const key = `${t.provider}:${t.providerId}`;
                            const typeLabel = t.type === "movie" ? "영화" : t.type === "series" ? "시리즈" : "책";
                            const meta = t.type === "book"
                                ? [t.author, t.publisher, t.year ? String(t.year) : null].filter(Boolean).join(" · ")
                                : `${typeLabel}${t.year ? ` · ${t.year}` : ""}`;
                            const detailLine = t.type === "book"
                                ? (t.isbn13 || t.isbn10 ? `ISBN ${t.isbn13 ?? t.isbn10}` : t.overview)
                                : t.overview;

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => pick(t)}
                                    onMouseEnter={() => setActiveIndex(idx)}
                                    className={cn(
                                        "flex w-full items-center gap-4 px-4 py-3 text-left transition-colors",
                                        isRetro 
                                            ? (idx === activeIndex ? "bg-yellow-100 border-b-2 border-black last:border-b-0" : "border-b-2 border-black hover:bg-neutral-50 last:border-b-0")
                                            : (idx === activeIndex ? "bg-muted" : "hover:bg-muted")
                                    )}
                                >
                                    <div className={cn(
                                        "h-24 w-16 shrink-0 overflow-hidden bg-muted",
                                        isRetro ? "border-2 border-black" : "rounded-lg shadow-sm border border-border"
                                    )}>
                                        {t.posterUrl ? (
                                            <img
                                                src={tmdbResize(t.posterUrl, "w185") ?? t.posterUrl}
                                                alt={t.name}
                                                className={cn("h-full w-full object-cover", isRetro && "pixelated")}
                                                style={isRetro ? { imageRendering: "pixelated" } : {}}
                                                loading="lazy"
                                            />
                                        ) : null}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className={cn("truncate text-sm font-bold uppercase", !isRetro && "normal-case")}>
                                            {t.name}
                                        </div>
                                        <div className={cn("mt-0.5", isRetro ? "text-xs font-semibold text-neutral-700" : "text-[10px] font-bold text-muted-foreground")}>
                                            {t.type === "book" ? `책${meta ? ` · ${meta}` : ""}` : meta}
                                        </div>
                                        {detailLine ? (
                                            <div className={cn("mt-1 line-clamp-1", isRetro ? "text-xs text-neutral-700" : "text-[10px] font-bold text-muted-foreground")}>
                                                {detailLine}
                                            </div>
                                        ) : null}
                                    </div>
                                </button>
                            );
                        })}

                    {!loading && !err && items.length === 0 && query && (
                        <div className="px-4 py-3 text-sm font-bold text-muted-foreground">결과가 없어요</div>
                    )}

                    {query && contentType === "video" ? (
                        <div className={cn(
                            "px-4 py-2 text-[8px] font-bold text-muted-foreground",
                            isRetro ? "border-t-4 border-black bg-neutral-100" : "border-t border-border"
                        )}>
                            THIS PRODUCT USES THE TMDB API BUT IS NOT ENDORSED OR CERTIFIED BY TMDB.
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}
