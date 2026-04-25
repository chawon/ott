"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { DiscussionListItem, TitleSearchItem } from "@/lib/types";
import { cn, tmdbResize } from "@/lib/utils";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function TitleSearchBox({
  onSelect,
  placeholder,
  showRecentDiscussions = true,
  contentType = "video",
  initialQuery,
  autoFocus = false,
}: {
  onSelect: (item: TitleSearchItem) => void;
  placeholder?: string;
  showRecentDiscussions?: boolean;
  contentType?: "video" | "book";
  initialQuery?: string;
  autoFocus?: boolean;
}) {
  const tTitleSearch = useTranslations("TitleSearchBox");
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const consumedInitialRef = useRef<string | null>(null);

  const query = useMemo(() => q.trim(), [q]);

  useEffect(() => {
    const next = initialQuery?.trim();
    if (!next) return;
    if (consumedInitialRef.current === next) return;
    consumedInitialRef.current = next;
    setQ(next);
    setOpen(true);
  }, [initialQuery]);

  useEffect(() => {
    if (!open) return;

    if (!query) {
      setItems([]);
      setErr(null);
      setLoading(false);
      setActiveIndex(0);
      return;
    }

    let cancelled = false;

    const t = setTimeout(async () => {
      setLoading(true);
      setErr(null);

      try {
        const typeQuery = contentType === "book" ? "&type=book" : "";
        const res = await api<TitleSearchItem[]>(
          `/titles/search?q=${encodeURIComponent(query)}${typeQuery}`,
        );
        if (!cancelled) {
          setItems(res);
          setActiveIndex(0);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setItems([]);
          setActiveIndex(0);
          setErr(errorMessage(e, "Search failed"));
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
        const res = await api<DiscussionListItem[]>(
          "/discussions/latest?limit=6&days=14",
        );
        if (!cancelled) setRecent(res);
      } catch (e: unknown) {
        if (!cancelled) {
          setRecent([]);
          setRecentErr(errorMessage(e, "Failed to load discussions"));
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
    if (contentType === "book")
      return recent.filter((d) => d.titleType === "book");
    return recent.filter(
      (d) => d.titleType === "movie" || d.titleType === "series",
    );
  }, [contentType, recent]);

  const showRecentPanel =
    showRecentDiscussions &&
    !query &&
    (recentLoading || recentErr || filteredRecent.length > 0);
  const showPanel =
    open && (loading || err || items.length > 0 || showRecentPanel);

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
    setOpen(true);
  }, [autoFocus]);

  const modernPlaceholder = placeholder || tTitleSearch("defaultPlaceholder");

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
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
        placeholder={modernPlaceholder}
        className={cn(
          "w-full transition-all outline-none",
          "min-h-12 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:ring-2 focus:ring-ring/40 focus:border-border placeholder:text-muted-foreground",
        )}
      />

      {showPanel && (
        <div
          className={cn(
            "absolute z-50 mt-2 w-full max-h-[calc(100dvh-var(--mobile-bottom-nav-height)-9rem)] overflow-auto bg-card text-card-foreground sm:max-h-[70vh]",
            "rounded-xl border border-border shadow-xl",
          )}
          data-onboarding-target="title-search-panel"
        >
          {showRecentPanel ? (
            <div className={cn("border-b border-border")}>
              <div
                className={cn(
                  "px-4 py-2 text-[10px] font-bold uppercase tracking-widest",
                  "text-muted-foreground",
                )}
              >
                {tTitleSearch("recentModern")}
              </div>
              {recentLoading ? (
                <div className="px-4 py-3 text-sm font-bold">
                  {tTitleSearch("loading")}
                </div>
              ) : null}
              {!recentLoading && recentErr ? (
                <div className="px-4 py-3 text-sm text-red-600 font-bold">
                  {recentErr}
                </div>
              ) : null}
              {!recentLoading && !recentErr && recent.length === 0 ? (
                <div className="px-4 py-3 text-sm font-bold text-muted-foreground">
                  {tTitleSearch("empty")}
                </div>
              ) : null}
              {!recentLoading &&
                !recentErr &&
                filteredRecent.map((d) => {
                  const typeLabel =
                    d.titleType === "movie"
                      ? tTitleSearch("typeMovie")
                      : d.titleType === "series"
                        ? tTitleSearch("typeSeries")
                        : tTitleSearch("typeBook");
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
                        "hover:bg-muted",
                      )}
                    >
                      <div
                        className={cn(
                          "h-20 w-14 shrink-0 overflow-hidden bg-muted",
                          "rounded-lg shadow-sm border border-border",
                        )}
                      >
                        {d.posterUrl ? (
                          <img
                            src={tmdbResize(d.posterUrl, "w185") ?? d.posterUrl}
                            alt={d.titleName}
                            className={cn("h-full w-full object-cover")}
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn("truncate text-sm font-bold")}>
                          {d.titleName}
                        </div>
                        <div
                          className={cn(
                            "mt-0.5",
                            "text-[10px] font-bold text-muted-foreground",
                          )}
                        >
                          {meta}
                        </div>
                        <div
                          className={cn(
                            "mt-1 text-xs font-semibold",
                            "text-muted-foreground",
                          )}
                        >
                          {tTitleSearch("commentCount", {
                            count: d.commentCount,
                          })}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          ) : null}

          {loading && (
            <div className="px-4 py-3 text-sm font-bold">
              {tTitleSearch("searchLoading")}
            </div>
          )}

          {!loading && err && (
            <div className="px-4 py-3 text-sm text-red-600 font-bold">
              {err}
            </div>
          )}

          {!loading &&
            !err &&
            items.map((t, idx) => {
              const key = `${t.provider}:${t.providerId}`;
              const typeLabel =
                t.type === "movie"
                  ? tTitleSearch("typeMovie")
                  : t.type === "series"
                    ? tTitleSearch("typeSeries")
                    : tTitleSearch("typeBook");
              const meta =
                t.type === "book"
                  ? [t.author, t.publisher, t.year ? String(t.year) : null]
                      .filter(Boolean)
                      .join(" · ")
                  : `${typeLabel}${t.year ? ` · ${t.year}` : ""}`;
              const detailLine =
                t.type === "book"
                  ? t.isbn13 || t.isbn10
                    ? `ISBN ${t.isbn13 ?? t.isbn10}`
                    : t.overview
                  : t.overview;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pick(t)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    "flex w-full items-center gap-4 px-4 py-3 text-left transition-colors",
                    idx === activeIndex ? "bg-muted" : "hover:bg-muted",
                  )}
                >
                  <div
                    className={cn(
                      "h-24 w-16 shrink-0 overflow-hidden bg-muted",
                      "rounded-lg shadow-sm border border-border",
                    )}
                  >
                    {t.posterUrl ? (
                      <img
                        src={tmdbResize(t.posterUrl, "w185") ?? t.posterUrl}
                        alt={t.name}
                        className={cn("h-full w-full object-cover")}
                        loading="lazy"
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-sm font-bold")}>
                      {t.name}
                    </div>
                    <div
                      className={cn(
                        "mt-0.5",
                        "text-[10px] font-bold text-muted-foreground",
                      )}
                    >
                      {t.type === "book"
                        ? tTitleSearch("typeBook") + (meta ? ` · ${meta}` : "")
                        : meta}
                    </div>
                    {detailLine ? (
                      <div
                        className={cn(
                          "mt-1 line-clamp-1",
                          "text-[10px] font-bold text-muted-foreground",
                        )}
                      >
                        {detailLine}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}

          {!loading && !err && items.length === 0 && (
            <div className="px-4 py-3 text-sm font-bold text-muted-foreground">
              {tTitleSearch("searchEmpty")}
            </div>
          )}

          {query && contentType === "video" ? (
            <div
              className={cn(
                "px-4 py-2 text-[8px] font-bold text-muted-foreground",
                "border-t border-border",
              )}
            >
              THIS PRODUCT USES THE TMDB API BUT IS NOT ENDORSED OR CERTIFIED BY
              TMDB.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
