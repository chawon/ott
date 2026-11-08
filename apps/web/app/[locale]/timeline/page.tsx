"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Download,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import FiltersBar from "@/components/FiltersBar";
import GoogleBooksAttribution from "@/components/GoogleBooksAttribution";
import LogCard from "@/components/LogCard";
import QuickLogDialog from "@/components/QuickLogDialog";
import recordingStyles from "@/components/recording.module.css";
import ShareBottomSheet from "@/components/ShareBottomSheet";
import { monthKey, monthLabel } from "@/components/timeline-v2/RecordParts";
import styles from "@/components/timeline-v2/timeline.module.css";
import { Link as IntlLink } from "@/i18n/routing";
import { trackEvent } from "@/lib/analytics";
import { apiWithAuth } from "@/lib/api";
import { isKdcBookshelfLocale, normalizeBookIsbn13 } from "@/lib/bookshelf";
import { getCachedClassificationsForLogs } from "@/lib/bookshelfStore";
import { downloadTimelineCsv } from "@/lib/export";
import { googleBooksUrl } from "@/lib/googleBooks";
import { getUserId, listLogsLocal, upsertLogsLocal } from "@/lib/localStore";
import { isProfileComplete } from "@/lib/profile";
import { recommendationRequest } from "@/lib/recommendationApi";
import { readMomentFilters } from "@/lib/timelineMoments";
import type {
  BookClassification,
  Occasion,
  Place,
  RecommendationItem,
  Status,
  TitleSearchItem,
  WatchLog,
} from "@/lib/types";
import { useRecommendations } from "@/lib/useRecommendations";
import { useUserProfile } from "@/lib/useUserProfile";
import { cn } from "@/lib/utils";

export default function TimelinePage() {
  return (
    <Suspense fallback={<TimelineLoadingSkeleton />}>
      <TimelinePageContent />
    </Suspense>
  );
}

const TIMELINE_PAGE_SIZE = 50;

type TimelinePageResponse = {
  items: WatchLog[];
  nextCursor: string | null;
};

function buildQuery(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v?.trim()) qs.set(k, v.trim());
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const FUTURE_LOADING_MESSAGES_KO = [
  "남겨둔 이야기를 펼쳐보고 있어요.",
  "마음에 남았던 작품들을 살펴보고 있어요.",
  "다음에 만날 이야기를 고르고 있어요.",
  "미래의 타임라인을 준비하고 있어요.",
  "작품의 표지를 불러오고 있어요.",
];
const FUTURE_LOADING_MESSAGES_EN = [
  "Looking through the stories you kept.",
  "Revisiting the titles that stayed with you.",
  "Finding a few stories you might enjoy.",
  "Putting your future timeline together.",
  "Bringing in the covers.",
];

function FutureLoadingSkeleton({
  t,
}: {
  t: ReturnType<typeof useTranslations>;
}) {
  const [msgIdx, setMsgIdx] = useState(0);
  const messages = t("futureTitle").includes("미래")
    ? FUTURE_LOADING_MESSAGES_KO
    : FUTURE_LOADING_MESSAGES_EN;

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIdx((i) => (i + 1) % messages.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [messages.length]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
        <span className="transition-all duration-500">{messages[msgIdx]}</span>
      </div>

      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="overflow-hidden rounded-lg border border-border bg-card"
        >
          <div className="flex gap-3 p-3">
            <div className="shrink-0 h-[84px] w-[56px] rounded-lg bg-muted animate-pulse" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/4 rounded-full bg-muted animate-pulse" />
              <div className="flex gap-1">
                <div className="h-3 w-10 rounded-full bg-muted animate-pulse" />
                <div className="h-3 w-12 rounded-full bg-muted animate-pulse" />
              </div>
              <div className="h-3 w-full rounded bg-muted animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineLoadingSkeleton() {
  const rows = [
    "timeline-skeleton-1",
    "timeline-skeleton-2",
    "timeline-skeleton-3",
    "timeline-skeleton-4",
    "timeline-skeleton-5",
    "timeline-skeleton-6",
    "timeline-skeleton-7",
    "timeline-skeleton-8",
  ];

  return (
    <div className="space-y-3" aria-hidden="true">
      {rows.map((row) => (
        <div key={row} className="rounded-lg border border-border bg-card p-3">
          <div className="flex gap-3">
            <div className="h-32 w-20 shrink-0 rounded-lg bg-muted animate-pulse" />
            <div className="min-w-0 flex-1 space-y-3 py-1">
              <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
              <div className="flex gap-2">
                <div className="h-5 w-14 rounded-full bg-muted animate-pulse" />
                <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
              </div>
              <div className="h-3 w-full rounded bg-muted animate-pulse" />
              <div className="h-3 w-4/5 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FutureTimelineSection({
  recommendations,
  t,
}: {
  recommendations: ReturnType<typeof useRecommendations>;
  t: ReturnType<typeof useTranslations>;
}) {
  const locale = useLocale();
  const {
    visible,
    loading,
    error,
    canRefresh,
    generate,
    retry,
    dismiss,
    lastDismissed,
    undoDismiss,
    quota,
    pendingCount,
    syncError,
    eligible,
  } = recommendations;
  const [catalog, setCatalog] = useState<RecommendationItem | null>(null);
  const [candidates, setCandidates] = useState<TitleSearchItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const [recording, setRecording] = useState<{
    title?: TitleSearchItem;
    item: RecommendationItem;
  } | null>(null);
  const catalogRequest = useRef<AbortController | null>(null);
  const openingRecord = useRef(false);

  useEffect(() => () => catalogRequest.current?.abort(), []);

  const typeLabel = (type: string) =>
    type === "movie"
      ? t("typeMovie")
      : type === "series"
        ? t("typeSeries")
        : t("typeBook");

  async function findCatalog(item: RecommendationItem) {
    catalogRequest.current?.abort();
    const userId = getUserId();
    if (!userId) return;
    const controller = new AbortController();
    catalogRequest.current = controller;
    setCatalog(item);
    setCandidates([]);
    setCatalogLoading(true);
    setCatalogError(false);
    try {
      const params = new URLSearchParams({ name: item.name, type: item.type });
      if (item.year) params.set("year", String(item.year));
      if (item.author) params.set("author", item.author);
      const response = await recommendationRequest<TitleSearchItem[]>(
        `/catalog?${params}`,
        { userId, locale, signal: controller.signal },
      );
      if (
        controller.signal.aborted ||
        catalogRequest.current !== controller ||
        getUserId() !== userId
      )
        return;
      const all = [
        ...(item.catalogTitle?.type === item.type ? [item.catalogTitle] : []),
        ...response.data.filter((candidate) => candidate.type === item.type),
      ];
      setCandidates(
        all.filter(
          (candidate, index) =>
            !all
              .slice(0, index)
              .some(
                (previous) =>
                  previous.provider === candidate.provider &&
                  previous.providerId === candidate.providerId,
              ),
        ),
      );
    } catch {
      if (!controller.signal.aborted && catalogRequest.current === controller)
        setCatalogError(true);
    } finally {
      if (!controller.signal.aborted && catalogRequest.current === controller)
        setCatalogLoading(false);
    }
  }

  function openRecommendation(item: RecommendationItem) {
    if (item.type !== "book" && item.catalogTitle?.type === item.type) {
      setRecording({ title: item.catalogTitle, item });
    } else {
      void findCatalog(item);
    }
  }

  function chooseCatalog(title: TitleSearchItem) {
    if (!catalog) return;
    openingRecord.current = true;
    setRecording({ title, item: catalog });
    setCatalog(null);
  }

  const reset = quota
    ? new Intl.DateTimeFormat(locale, {
        timeZone: quota.timezone,
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(quota.resetsAt))
    : "";

  return (
    <section
      className="space-y-3"
      aria-label={t("futureTitle")}
      aria-busy={loading}
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={loading || !canRefresh}
          className={cn(
            "min-h-12 rounded-lg border border-border bg-card px-4 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            (loading || !canRefresh) && "opacity-40 cursor-not-allowed",
          )}
        >
          {t("refreshButton")}
        </button>
        {quota && (
          <p role="status" className="text-sm text-muted-foreground">
            {quota.remaining > 0
              ? t("futureQuotaRemaining", { remaining: quota.remaining })
              : t("futureQuotaExhausted")}
          </p>
        )}
      </div>
      {quota?.remaining === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("futureQuotaReset", { reset })}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{t("futureTasteHint")}</p>

      {lastDismissed && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground"
        >
          <span>{t("dismissedNotice")}</span>
          <button
            type="button"
            onClick={undoDismiss}
            className="min-h-12 rounded-lg border border-border px-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {t("undoDismiss")}
          </button>
        </div>
      )}
      {(pendingCount > 0 || syncError) && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground"
        >
          <span>{t("futureSyncPending")}</span>
          <button
            type="button"
            onClick={recommendations.load}
            className="min-h-12 rounded-lg border border-border px-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {t("retryLoadMore")}
          </button>
        </div>
      )}
      {loading && <FutureLoadingSkeleton t={t} />}
      {!loading && error && (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground"
        >
          <p>{t("futureError")}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-3 min-h-12 rounded-lg border border-border px-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {t("retryLoadMore")}
          </button>
        </div>
      )}
      {!loading && !error && visible.length === 0 && (
        <div
          role="status"
          className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground"
        >
          {t(eligible ? "futureEmpty" : "futureNeedMoreLogs")}
        </div>
      )}
      {!loading && visible.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {visible.map((item) => (
            <div
              key={`${item.type}:${item.provider ?? ""}:${item.providerId ?? item.name}`}
              className="flex gap-5 rounded-lg border border-border bg-card p-5"
            >
              <button
                type="button"
                onClick={() => openRecommendation(item)}
                aria-label={t("futureOpenTitle", { name: item.name })}
                className="h-32 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {item.posterUrl ? (
                  <Image
                    src={item.posterUrl}
                    alt=""
                    width={80}
                    height={128}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {typeLabel(item.type)}
                  </span>
                )}
              </button>
              <div className="grid min-w-0 flex-1 grid-cols-1 content-start gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-3">
                <button
                  type="button"
                  onClick={() => openRecommendation(item)}
                  className="min-w-0 text-left font-semibold leading-snug hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:col-start-1"
                >
                  {item.name}
                </button>
                <div className="flex flex-wrap gap-1.5 md:col-start-1">
                  <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {typeLabel(item.type)}
                  </span>
                  {item.year != null && (
                    <span className="self-center text-xs text-muted-foreground">
                      {item.year}
                    </span>
                  )}
                  {item.genres?.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
                {item.author && (
                  <p className="text-sm text-muted-foreground md:col-start-1">
                    {item.author}
                  </p>
                )}
                <p className="text-sm leading-relaxed text-muted-foreground md:col-start-1">
                  {item.reason}
                </p>
                {item.catalogTitle && googleBooksUrl(item.catalogTitle) && (
                  <div className="md:col-start-1">
                    <GoogleBooksAttribution
                      href={googleBooksUrl(item.catalogTitle) ?? undefined}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => openRecommendation(item)}
                  className="min-h-12 justify-self-start rounded-lg border border-border px-4 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:col-start-1"
                >
                  {t(
                    item.type === "book" ? "futureWantRead" : "futureWantWatch",
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(item)}
                  className="flex min-h-12 items-center gap-1 self-start justify-self-start rounded-lg border border-border px-3 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:col-start-2 md:row-start-1 md:row-span-3"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                  {t("dismissButton")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog.Root
        open={catalog !== null}
        onOpenChange={(open) => {
          if (!open) {
            catalogRequest.current?.abort();
            setCatalog(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={recordingStyles.overlay} />
          <Dialog.Content
            className={recordingStyles.dialog}
            data-record-stage="catalog"
            onCloseAutoFocus={(event) => {
              if (openingRecord.current) {
                event.preventDefault();
                openingRecord.current = false;
              }
            }}
          >
            <header className={recordingStyles.dialogHeader}>
              <div className="min-w-0 flex-1">
                <Dialog.Title>
                  {t(
                    catalog?.type === "book"
                      ? "futureChooseEdition"
                      : "futureChooseTitle",
                  )}
                </Dialog.Title>
                <Dialog.Description className={recordingStyles.description}>
                  {t(
                    catalog?.type === "book"
                      ? "futureEditionHint"
                      : "futureCatalogHint",
                  )}
                </Dialog.Description>
              </div>
              <Dialog.Close
                className={recordingStyles.close}
                aria-label={t("futureCatalogClose")}
              >
                <X aria-hidden="true" size={22} />
              </Dialog.Close>
            </header>
            <div
              className={cn(
                recordingStyles.dialogBody,
                "space-y-3 overflow-y-auto p-4",
              )}
              aria-busy={catalogLoading}
            >
              {catalogLoading ? (
                <p role="status" className="p-4 text-sm text-muted-foreground">
                  {t("futureCatalogLoading")}
                </p>
              ) : catalogError ? (
                <div role="alert">
                  <p>{t("futureCatalogError")}</p>
                  <button
                    type="button"
                    className="mt-3 min-h-12 rounded-lg border border-border px-4"
                    onClick={() => catalog && void findCatalog(catalog)}
                  >
                    {t("retryLoadMore")}
                  </button>
                </div>
              ) : candidates.length ? (
                candidates.map((candidate) => (
                  <div key={`${candidate.provider}:${candidate.providerId}`}>
                    <button
                      type="button"
                      onClick={() => chooseCatalog(candidate)}
                      className="flex w-full items-start gap-4 rounded-lg border border-border bg-card p-4 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {candidate.posterUrl && (
                        <Image
                          src={candidate.posterUrl}
                          alt=""
                          width={48}
                          height={72}
                          className="h-[72px] w-12 shrink-0 object-cover"
                        />
                      )}
                      <span className="min-w-0">
                        <strong className="block font-semibold">
                          {candidate.name}
                        </strong>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {[
                            candidate.author,
                            candidate.publisher,
                            candidate.year,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {(candidate.isbn13 || candidate.isbn10) && (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            ISBN {candidate.isbn13 || candidate.isbn10}
                          </span>
                        )}
                      </span>
                    </button>
                    {googleBooksUrl(candidate) && (
                      <GoogleBooksAttribution
                        href={googleBooksUrl(candidate) ?? undefined}
                      />
                    )}
                  </div>
                ))
              ) : (
                <div
                  role="status"
                  className="p-4 text-sm text-muted-foreground"
                >
                  <p>{t("futureCatalogEmpty")}</p>
                  <button
                    type="button"
                    className="mt-3 min-h-12 rounded-lg border border-border px-4"
                    onClick={() => {
                      if (catalog) {
                        openingRecord.current = true;
                        setRecording({ item: catalog });
                        setCatalog(null);
                      }
                    }}
                  >
                    {t("futureSearchAgain")}
                  </button>
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {recording && (
        <QuickLogDialog
          open
          onOpenChange={(open) => {
            if (!open) setRecording(null);
          }}
          initialCatalogTitle={recording.title}
          initialContentType={recording.item.type === "book" ? "book" : "video"}
          initialSearchQuery={recording.title ? undefined : recording.item.name}
          highlightedStatus="WISHLIST"
          onCreated={recommendations.recordCreated}
        />
      )}
    </section>
  );
}

function TimelinePageContent() {
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLog, setShareLog] = useState<WatchLog | null>(null);
  const locale = useLocale();
  const tTimeline = useTranslations("Timeline");
  const tStatus = useTranslations("Status");
  const tCommon = useTranslations("Common");
  const tCsv = useTranslations("CSV");
  const tQuick = useTranslations("QuickLogCard");
  const tAccount = useTranslations("Account");
  const tProfile = useTranslations("Profile");
  const tBookshelf = useTranslations("Bookshelf");
  const { profile } = useUserProfile();
  const [status, setStatus] = useState<Status | "ALL">("ALL");
  const [contentType, setContentType] = useState<"ALL" | "video" | "book">(
    "ALL",
  );
  const [origin, setOrigin] = useState<"ALL" | "LOG" | "COMMENT">("ALL");
  const [ott, setOtt] = useState("");
  const searchParams = useSearchParams();
  const { place, occasion } = readMomentFilters(searchParams);
  const updateMoment = (
    field: "place" | "occasion",
    value: Place | Occasion | "",
  ) => {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(field, value);
    else params.delete(field);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    );
  };
  const setPlace = (value: Place | "") => updateMoment("place", value);
  const setOccasion = (value: Occasion | "") => updateMoment("occasion", value);
  const [query, setQuery] = useState("");
  const [logs, setLogs] = useState<WatchLog[]>([]);
  const [visibleLimit, setVisibleLimit] = useState(TIMELINE_PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [bookClassifications, setBookClassifications] = useState<
    Map<string, BookClassification>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  const [futureMode, setFutureMode] = useState(false);
  const recommendations = useRecommendations(locale, futureMode);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const filterGenerationRef = useRef(0);
  const nextCursorRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (contentType === "ALL") {
      setStatus("ALL");
    }
    setOtt("");
  }, [contentType]);

  const loadLocalPage = useCallback(
    async (limit: number) => {
      const items = await listLogsLocal({
        limit: limit + 1,
        contentType: contentType === "ALL" ? undefined : contentType,
        status: status === "ALL" ? undefined : status,
        origin: origin === "ALL" ? undefined : origin,
        ott: ott.trim() ? ott : undefined,
        place: place || undefined,
        occasion: occasion || undefined,
        query: query.trim() ? query : undefined,
        sortBy: "history",
      });
      return {
        logs: items.slice(0, limit),
        hasMore: items.length > limit,
      };
    },
    [contentType, origin, ott, query, status, place, occasion],
  );

  const serverPagePath = useCallback(
    (cursor?: string | null) => {
      const requestQuery = buildQuery({
        limit: String(TIMELINE_PAGE_SIZE),
        status: status === "ALL" ? undefined : status,
        origin: origin === "ALL" ? undefined : origin,
        ott: ott.trim() ? ott : undefined,
        place: place || undefined,
        occasion: occasion || undefined,
        q: query.trim() ? query : undefined,
        sort: "history",
        contentType: contentType === "ALL" ? undefined : contentType,
        cursor: cursor ?? undefined,
      });
      return `/logs/page${requestQuery}`;
    },
    [contentType, origin, ott, query, status, place, occasion],
  );

  useEffect(() => {
    let cancelled = false;
    const generation = ++filterGenerationRef.current;

    nextCursorRef.current = null;
    loadingMoreRef.current = false;
    setVisibleLimit(TIMELINE_PAGE_SIZE);
    setHasMore(false);
    setLoadingMore(false);
    setLoadMoreError(false);

    const timer = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      let hadLocal = false;

      try {
        const cached = await loadLocalPage(TIMELINE_PAGE_SIZE);
        if (!cancelled && generation === filterGenerationRef.current) {
          if (cached.logs.length > 0) hadLocal = true;
          setLogs(cached.logs);
          setHasMore(cached.hasMore);
        }

        if (getUserId()) {
          const res = await apiWithAuth<TimelinePageResponse>(serverPagePath());
          await upsertLogsLocal(res.items);
          const refreshed = await loadLocalPage(TIMELINE_PAGE_SIZE);
          if (!cancelled && generation === filterGenerationRef.current) {
            nextCursorRef.current = res.nextCursor;
            setLogs(refreshed.logs);
            setHasMore(refreshed.hasMore || Boolean(res.nextCursor));
          }
        }
      } catch (error) {
        if (!cancelled && generation === filterGenerationRef.current) {
          setErr(getErrorMessage(error, "Failed to load records"));
          if (!hadLocal) setLogs([]);
        }
      } finally {
        if (!cancelled && generation === filterGenerationRef.current) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadLocalPage, serverPagePath]);

  useEffect(() => {
    if (!isKdcBookshelfLocale(locale)) {
      setBookClassifications(new Map());
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      const items = await getCachedClassificationsForLogs(logs);
      if (!cancelled) {
        setBookClassifications(
          new Map(items.map((item) => [item.isbn13, item])),
        );
      }
    };
    void refresh();
    window.addEventListener("bookshelf:updated", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("bookshelf:updated", refresh);
    };
  }, [locale, logs]);

  useEffect(() => {
    function handleSync() {
      if (loadingMoreRef.current) return;
      const generation = filterGenerationRef.current;
      void loadLocalPage(visibleLimit)
        .then((page) => {
          if (generation !== filterGenerationRef.current) return;
          setLogs(page.logs);
          setHasMore(page.hasMore || Boolean(nextCursorRef.current));
          setLoadMoreError(false);
        })
        .catch(() => {});
    }
    window.addEventListener("sync:updated", handleSync);
    return () => window.removeEventListener("sync:updated", handleSync);
  }, [loadLocalPage, visibleLimit]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current) return;

    const targetLimit = visibleLimit + TIMELINE_PAGE_SIZE;
    const generation = filterGenerationRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);

    try {
      const cursor = nextCursorRef.current;
      if (cursor && (typeof navigator === "undefined" || navigator.onLine)) {
        const response = await apiWithAuth<TimelinePageResponse>(
          serverPagePath(cursor),
        );
        if (generation !== filterGenerationRef.current) return;
        await upsertLogsLocal(response.items);
        if (generation !== filterGenerationRef.current) return;
        nextCursorRef.current = response.nextCursor;
      }

      const page = await loadLocalPage(targetLimit);
      if (generation !== filterGenerationRef.current) return;
      if (
        cursor &&
        typeof navigator !== "undefined" &&
        !navigator.onLine &&
        page.logs.length <= logs.length &&
        !page.hasMore
      ) {
        setLoadMoreError(true);
        return;
      }
      setVisibleLimit(targetLimit);
      setLogs(page.logs);
      setHasMore(page.hasMore || Boolean(nextCursorRef.current));
    } catch {
      if (generation !== filterGenerationRef.current) return;
      setLoadMoreError(true);
    } finally {
      if (generation === filterGenerationRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [hasMore, loadLocalPage, logs.length, serverPagePath, visibleLimit]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (
      !sentinel ||
      !hasMore ||
      loading ||
      loadingMore ||
      loadMoreError ||
      futureMode ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void loadMore();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [futureMode, hasMore, loadMore, loadMoreError, loading, loadingMore]);

  function enterFutureMode() {
    setFutureMode(true);
    trackEvent("recommendation_open");
  }

  const profileComplete = isProfileComplete(profile);
  const personaLabel = profileComplete
    ? tProfile(`personas.${profile?.personaKey}`)
    : null;
  const headerTitle = futureMode
    ? tTimeline("futureTitle")
    : profileComplete
      ? tTimeline("titlePersonalized", { nickname: profile?.nickname ?? "" })
      : tTimeline("titleModern");
  const futureButtonLabel = profileComplete
    ? tTimeline("futureButtonPersonalized", {
        nickname: profile?.nickname ?? "",
      })
    : tTimeline("futureButton");

  const headerSubtitle = useMemo(() => {
    if (futureMode) return null;
    if (loading) return tTimeline("loading");
    if (err) return err;
    if (personaLabel) {
      return tTimeline("subtitlePersonalized", { persona: personaLabel });
    }
    return tTimeline("subtitleModern");
  }, [futureMode, loading, err, personaLabel, tTimeline]);

  function exportFileName() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `watchlog-timeline-${y}${m}${d}-${hh}${mm}.csv`;
  }

  async function exportTimelineCsv() {
    setExporting(true);
    setExportStatus(null);
    try {
      const filtered = await listLogsLocal({
        contentType: contentType === "ALL" ? undefined : contentType,
        status: status === "ALL" ? undefined : status,
        origin: origin === "ALL" ? undefined : origin,
        ott: ott.trim() ? ott : undefined,
        place: place || undefined,
        occasion: occasion || undefined,
        query: query.trim() ? query : undefined,
        sortBy: "history",
      });
      if (filtered.length === 0) {
        setExportStatus(tAccount("statusNoMatchingLogs"));
        return;
      }
      downloadTimelineCsv(
        filtered,
        exportFileName(),
        tCsv,
        tStatus,
        tCommon,
        tQuick,
      );
      setExportStatus(tAccount("statusExportSuccess"));
    } catch (error) {
      setExportStatus(getErrorMessage(error, tAccount("statusExportFailed")));
    } finally {
      setExporting(false);
    }
  }

  const monthGroups = useMemo(() => {
    const groups = new Map<string, WatchLog[]>();
    for (const log of logs) {
      const date = new Date(log.updatedAt ?? log.watchedAt ?? log.createdAt);
      const key = monthKey(Number.isNaN(date.getTime()) ? null : date);
      groups.set(key, [...(groups.get(key) ?? []), log]);
    }
    return [...groups].map(([key, items]) => ({ key, items }));
  }, [logs]);

  return (
    <div className={styles.timelinePage}>
      <header className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>
            {locale === "ko" ? "남겨둔 이야기" : "THE STORIES YOU KEPT"}
          </p>
          <h1>{headerTitle}</h1>
          {headerSubtitle ? (
            <p className={styles.smallNote}>{headerSubtitle}</p>
          ) : null}
        </div>
        <div className={styles.timelineTools}>
          {!futureMode ? (
            <IntlLink
              href="/?quick=1"
              className={cn(styles.primaryButton, styles.mobileTimelineRecord)}
            >
              <Plus size={18} aria-hidden="true" />
              {locale === "ko" ? "기록 남기기" : "Leave a record"}
            </IntlLink>
          ) : null}
          {mounted && getUserId() && !futureMode ? (
            <button
              type="button"
              onClick={enterFutureMode}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Sparkles size={16} aria-hidden="true" />
              {futureButtonLabel}
            </button>
          ) : null}
          {!futureMode ? (
            <button
              type="button"
              onClick={exportTimelineCsv}
              disabled={exporting}
              title={tTimeline("exportCsv")}
              aria-label={tTimeline("exportCsv")}
              className={cn(
                "inline-flex min-h-12 w-12 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:hover:bg-card",
                exporting && "opacity-40",
              )}
            >
              <Download size={18} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setFutureMode(false)}
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {tTimeline("backButton")}
            </button>
          )}
        </div>
      </header>
      {exportStatus ? (
        <p className={styles.smallNote} role="status">
          {exportStatus}
        </p>
      ) : null}
      {futureMode ? (
        <FutureTimelineSection
          key={`${locale}:${recommendations.ownerId}`}
          recommendations={recommendations}
          t={tTimeline}
        />
      ) : (
        <>
          <nav
            className={styles.timelineShortcuts}
            aria-label={
              locale === "ko" ? "기록 돌아보기" : "Explore your records"
            }
          >
            <IntlLink href="/me/report">
              <BarChart3 size={17} aria-hidden="true" />
              {tTimeline("reportShortcutTitle")}
              <ArrowRight size={16} aria-hidden="true" />
            </IntlLink>
            {isKdcBookshelfLocale(locale) ? (
              <IntlLink href="/me/bookshelf">
                <BookOpen size={17} aria-hidden="true" />
                {tBookshelf("viewShelf")}
                <ArrowRight size={16} aria-hidden="true" />
              </IntlLink>
            ) : null}
          </nav>
          <FiltersBar
            status={status}
            setStatus={setStatus}
            origin={origin}
            setOrigin={setOrigin}
            ott={ott}
            setOtt={setOtt}
            query={query}
            setQuery={setQuery}
            contentType={contentType}
            setContentType={setContentType}
            place={place}
            setPlace={setPlace}
            occasion={occasion}
            setOccasion={setOccasion}
          />
          {loading && logs.length === 0 ? (
            <div>
              <output className="sr-only">{tTimeline("loading")}</output>
              <TimelineLoadingSkeleton />
            </div>
          ) : null}
          {!loading && logs.length === 0 && !err ? (
            <div className={styles.emptyTimeline}>
              <p>{tTimeline("emptyModern")}</p>
              <IntlLink href="/?quick=1" className={styles.quietLink}>
                {locale === "ko" ? "새로운 기록 남기기" : "Leave a new record"}
                <ArrowRight size={17} aria-hidden="true" />
              </IntlLink>
            </div>
          ) : null}
          <div className={styles.timelineList}>
            {monthGroups.map((group) => (
              <section
                key={group.key}
                aria-label={monthLabel(group.key, locale)}
              >
                <h2 className={styles.timelineMonth}>
                  {monthLabel(group.key, locale)}
                  <span>
                    {locale === "ko"
                      ? "최근 기록·수정한 날 기준"
                      : "By last recorded or updated"}
                  </span>
                </h2>
                {group.items.map((log) => (
                  <LogCard
                    key={log.id}
                    log={log}
                    bookClassification={
                      log.title.type === "book"
                        ? bookClassifications.get(
                            normalizeBookIsbn13(log.title) ?? "",
                          )
                        : null
                    }
                    onShareCard={() => {
                      setShareLog(log);
                      setShareOpen(true);
                    }}
                  />
                ))}
              </section>
            ))}
          </div>
          {logs.length > 0 &&
          (hasMore ||
            loadingMore ||
            loadMoreError ||
            visibleLimit > TIMELINE_PAGE_SIZE) ? (
            <div
              ref={loadMoreSentinelRef}
              className="flex min-h-20 flex-col items-center justify-center gap-2 py-3"
              aria-live="polite"
            >
              {loadMoreError ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {tTimeline("loadMoreError")}
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#1E4D8C] bg-card px-6 text-sm font-semibold text-[#1E4D8C] transition-colors hover:bg-ott-paper-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/50 dark:text-foreground"
                  >
                    {tTimeline("retryLoadMore")}
                  </button>
                </>
              ) : hasMore || loadingMore ? (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#1E4D8C] bg-card px-6 text-sm font-semibold text-[#1E4D8C] transition-colors hover:bg-ott-paper-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/50 disabled:border-border disabled:bg-[#ECEBE9] disabled:text-muted-foreground dark:text-foreground"
                >
                  {loadingMore
                    ? tTimeline("loadingMore")
                    : tTimeline("loadMore")}
                </button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {tTimeline("allLoaded")}
                </p>
              )}
            </div>
          ) : null}
        </>
      )}
      <ShareBottomSheet
        open={shareOpen}
        log={shareLog}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
