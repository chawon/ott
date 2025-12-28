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
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
            />

            {showPanel && (
                <div className="absolute z-10 mt-2 w-full max-h-[70vh] overflow-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                    {showRecentPanel ? (
                        <div className="border-b border-neutral-200">
                            <div className="px-4 pt-3 text-xs font-semibold text-neutral-500">
                                요즘 나누고 있는 작품들
                            </div>
                            {recentLoading ? (
                                <div className="px-4 py-3 text-sm text-neutral-500">
                                    불러오는 중…
                                </div>
                            ) : null}
                            {!recentLoading && recentErr ? (
                                <div className="px-4 py-3 text-sm text-red-600">{recentErr}</div>
                            ) : null}
                            {!recentLoading && !recentErr && recent.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-neutral-500">
                                    아직 없어요
                                </div>
                            ) : null}
                            {!recentLoading &&
                                !recentErr &&
                                recent.map((d) => {
                                    const typeLabel = d.titleType === "movie" ? "Movie" : "Series";
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
                                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50"
                                        >
                                            <div className="h-12 w-9 overflow-hidden rounded-md bg-neutral-100">
                                                {d.posterUrl ? (
                                                    <img
                                                        src={d.posterUrl}
                                                        alt={d.titleName}
                                                        className="h-full w-full object-cover"
                                                        loading="lazy"
                                                    />
                                                ) : null}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-medium text-neutral-900">
                                                    {d.titleName}
                                                </div>
                                                <div className="mt-0.5 text-xs text-neutral-500">{meta}</div>
                                                <div className="mt-1 text-[11px] text-neutral-500">
                                                    댓글 {d.commentCount}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                        </div>
                    ) : null}

                    {loading && (
                        <div className="px-4 py-3 text-sm text-neutral-500">검색 중…</div>
                    )}

                    {!loading && err && (
                        <div className="px-4 py-3 text-sm text-red-600">{err}</div>
                    )}

                    {!loading &&
                        !err &&
                        items.map((t, idx) => {
                            const key = `${t.provider}:${t.providerId}`;
                            const typeLabel = t.type === "movie" ? "Movie" : "Series";
                            const meta = `${typeLabel}${t.year ? ` · ${t.year}` : ""}`;

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => pick(t)}
                                    onMouseEnter={() => setActiveIndex(idx)}
                                    className={[
                                        "flex w-full items-center gap-3 px-4 py-3 text-left",
                                        idx === activeIndex ? "bg-neutral-50" : "hover:bg-neutral-50",
                                    ].join(" ")}
                                >
                                    <div className="h-12 w-9 overflow-hidden rounded-md bg-neutral-100">
                                        {/* next/image로 바꾸고 싶으면 바꿔도 됨 */}
                                        {t.posterUrl ? (
                                            <img
                                                src={t.posterUrl}
                                                alt={t.name}
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : null}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium text-neutral-900">
                                            {t.name}
                                        </div>
                                        <div className="mt-0.5 text-xs text-neutral-500">{meta}</div>
                                        {t.overview ? (
                                            <div className="mt-1 line-clamp-2 text-xs text-neutral-600">
                                                {t.overview}
                                            </div>
                                        ) : null}
                                    </div>
                                </button>
                            );
                        })}

                    {!loading && !err && items.length === 0 && query && (
                        <div className="px-4 py-3 text-sm text-neutral-500">
                            결과가 없어요
                        </div>
                    )}

                    {query ? (
                        <div className="border-t border-neutral-200 px-4 py-2 text-[11px] text-neutral-500">
                            This product uses the TMDB API but is not endorsed or certified by TMDB.
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}
