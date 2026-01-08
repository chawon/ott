"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { DiscussionListItem, TitleSearchItem } from "@/lib/types";

export default function TitleSearchBox({
                                           onSelect,
                                           placeholder = "작품 검색 (예: 듄, 더 베어)",
                                           showRecentDiscussions = true,
                                       }: {
    onSelect: (item: TitleSearchItem) => void;
    placeholder?: string;
    showRecentDiscussions?: boolean;
}) {
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
            return;
        }

        let cancelled = false;

        const t = setTimeout(async () => {
            setLoading(true);
            setErr(null);

            try {
                const res = await api<TitleSearchItem[]>(
                    `/titles/search?q=${encodeURIComponent(query)}`
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
    }, [query, open]);

    useEffect(() => {
        if (!open || !showRecentDiscussions) return;
        if (query) return;
        let cancelled = false;

        (async () => {
            setRecentLoading(true);
            setRecentErr(null);
            try {
                const res = await api<DiscussionListItem[]>("/discussions/latest?limit=6");
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

    const showRecentPanel = showRecentDiscussions && !query && (recentLoading || recentErr || recent.length > 0);
    const showPanel = open && (loading || err || items.length > 0 || showRecentPanel);

    useEffect(() => {
        setActiveIndex(0);
    }, [items]);

    return (
        <div ref={rootRef} className="relative">
            <input
                value={q}
                onChange={(e) => {
                    setQ(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
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
                placeholder={placeholder}
                className="w-full border-4 border-black bg-white px-4 py-3 text-sm font-bold outline-none shadow-[inset_4px_4px_0px_0px_#e0e0e0] focus:ring-4 focus:ring-yellow-400 focus:border-black"
            />

            {showPanel && (
                <div className="absolute z-10 mt-2 w-full max-h-[70vh] overflow-auto border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                    {showRecentPanel ? (
                        <div className="border-b-4 border-black">
                            <div className="bg-black px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                                Popular Titles
                            </div>
                            {recentLoading ? (
                                <div className="px-4 py-3 text-sm font-bold">
                                    LOADING...
                                </div>
                            ) : null}
                            {!recentLoading && recentErr ? (
                                <div className="px-4 py-3 text-sm text-red-600 font-bold">{recentErr}</div>
                            ) : null}
                            {!recentLoading && !recentErr && recent.length === 0 ? (
                                <div className="px-4 py-3 text-sm font-bold">
                                    EMPTY
                                </div>
                            ) : null}
                            {!recentLoading &&
                                !recentErr &&
                                recent.map((d) => {
                                    const meta = `${d.titleType === "movie" ? "MOVIE" : "SERIES"}${d.titleYear ? ` · ${d.titleYear}` : ""}`;
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
                                            className="flex w-full items-center gap-3 border-b-2 border-black px-4 py-3 text-left hover:bg-yellow-100 last:border-b-0"
                                        >
                                            <div className="h-12 w-9 shrink-0 border-2 border-black bg-neutral-200">
                                                {d.posterUrl ? (
                                                    <img
                                                        src={d.posterUrl}
                                                        alt={d.titleName}
                                                        className="h-full w-full object-cover pixelated"
                                                        style={{ imageRendering: "pixelated" }}
                                                        loading="lazy"
                                                    />
                                                ) : null}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-bold uppercase">
                                                    {d.titleName}
                                                </div>
                                                <div className="mt-0.5 text-[10px] font-bold text-neutral-500">{meta}</div>
                                                <div className="mt-1 text-[10px] font-bold text-blue-600 uppercase">
                                                    Comments: {d.commentCount}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                        </div>
                    ) : null}

                    {loading && (
                        <div className="px-4 py-3 text-sm font-bold">SEARCHING...</div>
                    )}

                    {!loading && err && (
                        <div className="px-4 py-3 text-sm text-red-600 font-bold">{err}</div>
                    )}

                    {!loading &&
                        !err &&
                        items.map((t, idx) => {
                            const key = `${t.provider}:${t.providerId}`;
                            const meta = `${t.type === "movie" ? "MOVIE" : "SERIES"}${t.year ? ` · ${t.year}` : ""}`;

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => pick(t)}
                                    onMouseEnter={() => setActiveIndex(idx)}
                                    className={[
                                        "flex w-full items-center gap-3 border-b-2 border-black px-4 py-3 text-left last:border-b-0",
                                        idx === activeIndex ? "bg-yellow-100" : "hover:bg-neutral-50",
                                    ].join(" ")}
                                >
                                    <div className="h-12 w-9 shrink-0 border-2 border-black bg-neutral-200">
                                        {t.posterUrl ? (
                                            <img
                                                src={t.posterUrl}
                                                alt={t.name}
                                                className="h-full w-full object-cover pixelated"
                                                style={{ imageRendering: "pixelated" }}
                                                loading="lazy"
                                            />
                                        ) : null}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-bold uppercase">
                                            {t.name}
                                        </div>
                                        <div className="mt-0.5 text-[10px] font-bold text-neutral-500">{meta}</div>
                                        {t.overview ? (
                                            <div className="mt-1 line-clamp-1 text-[10px] font-bold text-neutral-600">
                                                {t.overview}
                                            </div>
                                        ) : null}
                                    </div>
                                </button>
                            );
                        })}

                    {!loading && !err && items.length === 0 && query && (
                        <div className="px-4 py-3 text-sm font-bold">
                            NO RESULTS
                        </div>
                    )}

                    {query ? (
                        <div className="border-t-4 border-black bg-neutral-100 px-4 py-2 text-[8px] font-bold text-neutral-500">
                            THIS PRODUCT USES THE TMDB API BUT IS NOT ENDORSED OR CERTIFIED BY TMDB.
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}
