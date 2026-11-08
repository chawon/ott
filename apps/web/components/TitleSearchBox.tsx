"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import GoogleBooksAttribution from "@/components/GoogleBooksAttribution";
import { api } from "@/lib/api";
import { googleBooksUrl } from "@/lib/googleBooks";
import { selectPopularTitleFillers } from "@/lib/titleFallback";
import type {
  DiscussionListItem,
  TitleSearchItem,
  TitleSelectSource,
} from "@/lib/types";
import { cn, tmdbResize } from "@/lib/utils";
import styles from "./recording.module.css";

const TITLE_SUGGESTION_LIMIT = 6;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function filterRecentDiscussions(
  discussions: DiscussionListItem[],
  contentType: "video" | "book",
) {
  if (contentType === "book") {
    return discussions.filter((d) => d.titleType === "book");
  }
  return discussions.filter(
    (d) => d.titleType === "movie" || d.titleType === "series",
  );
}

export default function TitleSearchBox({
  onSelect,
  onSearchComplete,
  onSelectAnalytics,
  placeholder,
  showRecentDiscussions = true,
  contentType = "video",
  initialQuery,
  autoFocus = false,
  focusSignal = 0,
  dialogLayout = false,
  onContentTypeChange,
}: {
  onSelect: (item: TitleSearchItem) => void;
  onSearchComplete?: (result: {
    contentType: "video" | "book";
    queryLength: number;
    resultCount: number;
    success: boolean;
  }) => void;
  onSelectAnalytics?: (result: {
    item: TitleSearchItem;
    contentType: "video" | "book";
    source: TitleSelectSource;
    queryLength: number;
    resultRank?: number;
  }) => void;
  placeholder?: string;
  showRecentDiscussions?: boolean;
  contentType?: "video" | "book";
  initialQuery?: string;
  autoFocus?: boolean;
  focusSignal?: number;
  dialogLayout?: boolean;
  onContentTypeChange?: (type: "video" | "book") => void;
}) {
  const tTitleSearch = useTranslations("TitleSearchBox");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [searchType, setSearchType] = useState<
    "all" | "movie" | "series" | "book"
  >(contentType === "book" ? "book" : "all");
  const [composing, setComposing] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<TitleSearchItem[]>([]);
  const googleBooksSearch =
    locale === "en" &&
    (contentType === "book" ||
      items.some((item) => item.provider === "GOOGLE_BOOKS"));
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [partialSearch, setPartialSearch] = useState(false);
  const [recent, setRecent] = useState<DiscussionListItem[]>([]);
  const [popularSuggestions, setPopularSuggestions] = useState<
    TitleSearchItem[]
  >([]);
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
    // IME composition guards keyboard selection, not the debounced live query.
    if (!open) return;

    if (!query) {
      setPartialSearch(false);
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
      setPartialSearch(false);

      try {
        const selectedType =
          dialogLayout || onContentTypeChange
            ? searchType
            : contentType === "book"
              ? "book"
              : "all";
        const typeQuery =
          selectedType === "book"
            ? "&type=book"
            : selectedType === "movie"
              ? "&type=movie"
              : selectedType === "series"
                ? "&type=tv"
                : "";
        const searchPath = `/titles/search?q=${encodeURIComponent(query)}`;
        let res: TitleSearchItem[];
        if (dialogLayout && selectedType === "all") {
          const results = await Promise.allSettled([
            api<TitleSearchItem[]>(searchPath),
            api<TitleSearchItem[]>(`${searchPath}&type=book`),
          ]);
          const successful = results.filter(
            (result): result is PromiseFulfilledResult<TitleSearchItem[]> =>
              result.status === "fulfilled",
          );
          if (!successful.length)
            throw new Error(
              locale === "ko"
                ? "검색을 불러오지 못했어요. 잠시 후 다시 찾아보세요."
                : "Search is unavailable. Please try again.",
            );
          res = successful.flatMap((result) => result.value);
          if (!cancelled)
            setPartialSearch(successful.length !== results.length);
        } else {
          res = await api<TitleSearchItem[]>(`${searchPath}${typeQuery}`);
        }
        if (!cancelled) {
          setItems(res);
          setActiveIndex(0);
          onSearchComplete?.({
            contentType,
            queryLength: query.length,
            resultCount: res.length,
            success: true,
          });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setItems([]);
          setActiveIndex(0);
          setErr(errorMessage(e, "Search failed"));
          onSearchComplete?.({
            contentType,
            queryLength: query.length,
            resultCount: 0,
            success: false,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    query,
    open,
    contentType,
    onSearchComplete,
    dialogLayout,
    searchType,
    onContentTypeChange,
    locale,
  ]);

  useEffect(() => {
    if (!open || !showRecentDiscussions) return;
    if (query) return;
    let cancelled = false;

    (async () => {
      setRecentLoading(true);
      setRecentErr(null);
      setPopularSuggestions([]);
      try {
        const res = await api<DiscussionListItem[]>(
          `/discussions/latest?limit=${TITLE_SUGGESTION_LIMIT}&days=14`,
        );
        if (cancelled) return;

        setRecent(res);

        if (contentType !== "video") return;

        const videoRecent = filterRecentDiscussions(res, contentType).slice(
          0,
          TITLE_SUGGESTION_LIMIT,
        );
        const missingCount = Math.max(
          0,
          TITLE_SUGGESTION_LIMIT - videoRecent.length,
        );
        if (missingCount === 0) return;

        try {
          const trends = await api<TitleSearchItem[]>(
            `/titles/popular?limit=${TITLE_SUGGESTION_LIMIT * 2}`,
          );
          if (!cancelled) {
            setPopularSuggestions(
              selectPopularTitleFillers(videoRecent, trends, missingCount),
            );
          }
        } catch {
          if (!cancelled) setPopularSuggestions([]);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setRecent([]);
          setPopularSuggestions([]);
          setRecentErr(errorMessage(e, "Failed to load discussions"));
        }
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, query, showRecentDiscussions, contentType]);

  useEffect(() => {
    if (!open || dialogLayout) return;

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
  }, [open, dialogLayout]);

  function pick(
    item: TitleSearchItem,
    source: TitleSelectSource = "search_result",
    resultRank?: number,
  ) {
    onSelectAnalytics?.({
      item,
      contentType: item.type === "book" ? "book" : "video",
      source,
      queryLength: query.length,
      resultRank,
    });
    inputRef.current?.blur();
    onSelect(item);
    setQ("");
    setOpen(false);
    setItems([]);
    setErr(null);
    setActiveIndex(0);
  }

  const filteredRecent = useMemo(() => {
    return filterRecentDiscussions(recent, contentType)
      .filter(
        (item) =>
          !dialogLayout ||
          searchType === "all" ||
          item.titleType === searchType,
      )
      .slice(0, TITLE_SUGGESTION_LIMIT);
  }, [contentType, recent, searchType, dialogLayout]);

  const showRecentPanel =
    showRecentDiscussions &&
    !query &&
    (recentLoading ||
      recentErr ||
      filteredRecent.length > 0 ||
      popularSuggestions.length > 0);
  const showPanel =
    open &&
    (dialogLayout ||
      loading ||
      err ||
      items.length > 0 ||
      showRecentPanel ||
      Boolean(query));

  useEffect(() => {
    if (!autoFocus && focusSignal === 0) return;
    inputRef.current?.focus();
    setOpen(true);
  }, [autoFocus, focusSignal]);

  const modernPlaceholder = placeholder || tTitleSearch("defaultPlaceholder");

  return (
    <div ref={rootRef} className={dialogLayout ? styles.search : "relative"}>
      <input
        ref={inputRef}
        type="search"
        data-testid="title-search"
        aria-label={modernPlaceholder}
        maxLength={200}
        autoComplete="off"
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || composing || e.keyCode === 229)
            return;
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
            e.preventDefault();
            pick(
              items[Math.max(0, Math.min(activeIndex, items.length - 1))],
              "search_result",
              activeIndex + 1,
            );
          }
        }}
        placeholder={modernPlaceholder}
        className={
          dialogLayout
            ? styles.searchInput
            : cn(
                "w-full transition-all outline-none",
                "min-h-12 rounded-lg border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10",
              )
        }
      />

      {dialogLayout || onContentTypeChange ? (
        <fieldset className={styles.typeChoices}>
          <legend className="sr-only">
            {locale === "ko" ? "작품 종류" : "Title type"}
          </legend>
          {(["all", "movie", "series", "book"] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={searchType === type}
              onClick={() => {
                setSearchType(type);
                onContentTypeChange?.(type === "book" ? "book" : "video");
                setItems([]);
                setPartialSearch(false);
                setErr(null);
                setOpen(true);
              }}
            >
              {type === "all"
                ? locale === "ko"
                  ? dialogLayout
                    ? "전체"
                    : "영상 전체"
                  : dialogLayout
                    ? "All"
                    : "All video"
                : type === "movie"
                  ? tTitleSearch("typeMovie")
                  : type === "series"
                    ? tTitleSearch("typeSeries")
                    : tTitleSearch("typeBook")}
            </button>
          ))}
        </fieldset>
      ) : null}
      {googleBooksSearch ? (
        <div className="mt-2 flex justify-end">
          <GoogleBooksAttribution />
        </div>
      ) : null}

      {showPanel && (
        <div
          className={
            dialogLayout
              ? styles.searchResults
              : cn(
                  "absolute z-50 mt-2 w-full max-h-[calc(100dvh-var(--mobile-bottom-nav-height)-9rem)] overflow-auto bg-card text-card-foreground sm:max-h-[70vh]",
                  "rounded-lg border border-border shadow-lg",
                )
          }
          data-onboarding-target="title-search-panel"
        >
          {showRecentPanel ? (
            <div className={cn("border-b border-border")}>
              {recentLoading || recentErr || filteredRecent.length > 0 ? (
                <div
                  className={cn(
                    "px-4 py-2 text-[10px] font-bold uppercase tracking-widest",
                    "text-muted-foreground",
                  )}
                >
                  {tTitleSearch("recentModern")}
                </div>
              ) : null}
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
              {!recentLoading &&
              !recentErr &&
              filteredRecent.length === 0 &&
              popularSuggestions.length === 0 ? (
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
                      onClick={() => pick(item, "recent_discussion")}
                      className={cn(
                        "flex w-full items-center gap-4 px-4 py-3 text-left transition-colors",
                        "hover:bg-ott-paper-strong",
                      )}
                    >
                      <div
                        className={cn(
                          "h-20 w-14 shrink-0 overflow-hidden bg-muted",
                          "rounded-lg border border-border shadow-sm",
                        )}
                      >
                        {d.posterUrl ? (
                          <img
                            src={tmdbResize(d.posterUrl, "w185") ?? d.posterUrl}
                            alt={d.titleName}
                            className={cn(
                              "h-full w-full",
                              d.titleType === "book"
                                ? "object-contain"
                                : "object-cover",
                            )}
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn("line-clamp-2 text-base font-semibold")}
                        >
                          {d.titleName}
                        </div>
                        <div
                          className={cn(
                            "mt-0.5",
                            "text-xs text-muted-foreground",
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
              {!recentLoading && !recentErr && popularSuggestions.length > 0 ? (
                <div
                  className={cn(
                    filteredRecent.length > 0
                      ? "border-t border-border"
                      : undefined,
                  )}
                >
                  <div
                    className={cn(
                      "px-4 py-2 text-[10px] font-bold uppercase tracking-widest",
                      "text-muted-foreground",
                    )}
                  >
                    {tTitleSearch("popularModern")}
                  </div>
                  {popularSuggestions
                    .filter(
                      (item) =>
                        !dialogLayout ||
                        searchType === "all" ||
                        item.type === searchType,
                    )
                    .map((t) => {
                      const key = `popular:${t.provider}:${t.providerId}`;
                      const typeLabel =
                        t.type === "movie"
                          ? tTitleSearch("typeMovie")
                          : t.type === "series"
                            ? tTitleSearch("typeSeries")
                            : tTitleSearch("typeBook");
                      const meta = `${typeLabel}${t.year ? ` · ${t.year}` : ""}`;

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => pick(t, "popular_title")}
                          className={cn(
                            "flex w-full items-center gap-4 px-4 py-3 text-left transition-colors",
                            "hover:bg-ott-paper-strong",
                          )}
                        >
                          <div
                            className={cn(
                              "h-20 w-14 shrink-0 overflow-hidden bg-muted",
                              "rounded-lg border border-border shadow-sm",
                            )}
                          >
                            {t.posterUrl ? (
                              <Image
                                src={
                                  tmdbResize(t.posterUrl, "w185") ?? t.posterUrl
                                }
                                alt={t.name}
                                width={56}
                                height={80}
                                className={cn(
                                  "h-full w-full",
                                  t.type === "book"
                                    ? "object-contain"
                                    : "object-cover",
                                )}
                                loading="lazy"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn(
                                "line-clamp-2 text-base font-semibold",
                              )}
                            >
                              {t.name}
                            </div>
                            <div
                              className={cn(
                                "mt-0.5",
                                "text-xs text-muted-foreground",
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
                              {tTitleSearch("popularSource")}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              ) : null}
            </div>
          ) : null}

          {partialSearch && !loading ? (
            <p className={styles.hint} role="status">
              {locale === "ko"
                ? "일부 종류의 작품을 불러오지 못했어요. 종류를 골라 다시 찾아보세요."
                : "Some title types could not be loaded. Choose a type to try again."}
            </p>
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
                <div
                  key={key}
                  className="flex flex-col items-stretch sm:flex-row sm:items-center"
                >
                  <button
                    type="button"
                    data-testid="title-search-result"
                    data-title-provider={t.provider}
                    data-title-type={t.type}
                    data-title-id={t.providerId}
                    data-title-name={t.name}
                    onClick={() => pick(t, "search_result", idx + 1)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-4 px-4 py-3 text-left transition-colors",
                      idx === activeIndex
                        ? "bg-ott-paper-strong"
                        : "hover:bg-ott-paper-strong",
                    )}
                  >
                    <div
                      className={cn(
                        "h-24 w-16 shrink-0 overflow-hidden bg-muted",
                        "rounded-lg border border-border shadow-sm",
                      )}
                    >
                      {t.posterUrl ? (
                        <img
                          src={tmdbResize(t.posterUrl, "w185") ?? t.posterUrl}
                          alt={t.name}
                          className={cn(
                            "h-full w-full",
                            t.type === "book"
                              ? "object-contain"
                              : "object-cover",
                          )}
                          loading="lazy"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        className={cn("line-clamp-2 text-base font-semibold")}
                      >
                        {t.name}
                      </div>
                      <div
                        className={cn(
                          "mt-0.5",
                          "text-xs text-muted-foreground",
                        )}
                      >
                        {t.type === "book"
                          ? tTitleSearch("typeBook") +
                            (meta ? ` · ${meta}` : "")
                          : meta}
                      </div>
                      {detailLine ? (
                        <div
                          className={cn(
                            "mt-1 line-clamp-1",
                            "text-xs text-muted-foreground",
                          )}
                        >
                          {detailLine}
                        </div>
                      ) : null}
                    </div>
                  </button>
                  {googleBooksUrl(t) ? (
                    <div className="flex justify-end">
                      <GoogleBooksAttribution
                        href={googleBooksUrl(t)!}
                        logo={false}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}

          {query && !loading && !err && items.length === 0 && (
            <div className="px-4 py-3 text-sm font-bold text-muted-foreground">
              {tTitleSearch("searchEmpty")}
            </div>
          )}

          {contentType === "video" &&
          (query || popularSuggestions.length > 0) ? (
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
