"use client";

import { ArrowRight, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import AndroidWatchReminderCard from "@/components/AndroidWatchReminderCard";
import DiscussionList from "@/components/DiscussionList";
import FirstLogActivationPanel from "@/components/FirstLogActivationPanel";
import ProfilePromptCard from "@/components/ProfilePromptCard";
import QuickLogDialog from "@/components/QuickLogDialog";
import ShareBottomSheet from "@/components/ShareBottomSheet";
import SoftwareApplicationJsonLd from "@/components/SoftwareApplicationJsonLd";
import HomeTimelineView from "@/components/timeline-v2/HomeTimelineView";
import styles from "@/components/timeline-v2/timeline.module.css";
import { Link } from "@/i18n/routing";
import { trackEvent } from "@/lib/analytics";
import { api, apiWithAuth } from "@/lib/api";
import {
  countLogsLocal,
  dismissProfilePrompt,
  getDeviceId,
  getPairingCode,
  getUserId,
  isProfilePromptDismissed,
  listAllLogsLocal,
  upsertLogsLocal,
} from "@/lib/localStore";
import { isProfileComplete } from "@/lib/profile";
import {
  extractShareIntentUrls,
  inferShareIntentPlatform,
  parseShareIntentText,
  sanitizeResolvedTitle,
} from "@/lib/shareIntent";
import { selectPopularTitleFillers } from "@/lib/titleFallback";
import type {
  DiscussionListItem,
  Status,
  TitleSearchItem,
  TitleSelectSource,
  WatchLog,
} from "@/lib/types";
import { useUserProfile } from "@/lib/useUserProfile";

type ShareImportStatus = "imported" | "unresolved";
type ActivationContentType = "video" | "book";
type ActivationTitleSelection = {
  item: TitleSearchItem;
  source: Extract<
    TitleSelectSource,
    "activation_recent_discussion" | "activation_popular_title"
  >;
  nonce: number;
};

const HOME_DISCUSSION_LIMIT = 6;
const ACTIVATION_DISMISSED_KEY = "ottline.activation.dismissed";

function feedbackHref(source: string) {
  const params = new URLSearchParams({ source, from: "home" });
  return `/feedback?${params.toString()}`;
}

function platformFromCaptureKey(
  key: string | undefined,
  tQuick: ReturnType<typeof useTranslations>,
) {
  switch (key?.toLowerCase()) {
    case "netflix":
      return tQuick("platformNetflix");
    case "disney":
      return tQuick("platformDisney");
    case "tving":
      return tQuick("platformTving");
    case "wavve":
      return tQuick("platformWavve");
    case "coupang":
      return tQuick("platformCoupang");
    case "watcha":
      return tQuick("platformWatcha");
    default:
      return undefined;
  }
}

function DiscussionsSkeleton() {
  const rows = [
    "home-discussion-skeleton-1",
    "home-discussion-skeleton-2",
    "home-discussion-skeleton-3",
    "home-discussion-skeleton-4",
  ];

  return (
    <div
      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
      aria-hidden="true"
    >
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row} className="flex items-center gap-4 px-2 py-2">
            <div className="h-16 w-12 shrink-0 rounded-lg bg-muted animate-pulse" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-8 w-12 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const locale = useLocale();
  const tHome = useTranslations("HomePage");
  const tMetadata = useTranslations("Metadata");
  const tQuick = useTranslations("QuickLogCard");
  const [composerOpen, setComposerOpen] = useState(false);
  const [logs, setLogs] = useState<WatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [discussions, setDiscussions] = useState<DiscussionListItem[]>([]);
  const [trendingTitles, setTrendingTitles] = useState<TitleSearchItem[]>([]);
  const [activationPopularTitles, setActivationPopularTitles] = useState<
    TitleSearchItem[]
  >([]);
  const [discussionsLoading, setDiscussionsLoading] = useState(true);
  const [discussionsError, setDiscussionsError] = useState(false);
  const [quickType, setQuickType] = useState<"video" | "book">("video");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLog, setShareLog] = useState<WatchLog | null>(null);
  const [sharedQuery, setSharedQuery] = useState<string>("");
  const [sharedContentType, setSharedContentType] = useState<"video" | "book">(
    "video",
  );
  const [sharedPlatform, setSharedPlatform] = useState<string>("");
  const [shareImportStatus, setShareImportStatus] =
    useState<ShareImportStatus | null>(null);
  const [autoFocusSearch, setAutoFocusSearch] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [profilePromptHidden, setProfilePromptHidden] = useState(true);
  const [activationContentType, setActivationContentType] =
    useState<ActivationContentType>("video");
  const [activationEligible, setActivationEligible] = useState(false);
  const [activationDismissed, setActivationDismissed] = useState(false);
  const [activationForcedBypass, setActivationForcedBypass] = useState(false);
  const [activationTitleSelection, setActivationTitleSelection] =
    useState<ActivationTitleSelection | null>(null);
  const [, setActivationSelectionNonce] = useState(0);
  const [highlightedStatus, setHighlightedStatus] = useState<Status | null>(
    null,
  );
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);
  const { profile } = useUserProfile();

  const refreshProfilePromptState = useCallback(() => {
    setHasAccount(Boolean(getUserId() && getDeviceId()));
    setProfilePromptHidden(isProfilePromptDismissed());
  }, []);

  const refreshActivationEligibility = useCallback(async () => {
    const localCount = await countLogsLocal();
    setActivationEligible(localCount === 0 && !getPairingCode());
  }, []);

  const focusQuickLog = useCallback(() => {
    setComposerOpen(true);
    setAutoFocusSearch(true);
  }, []);

  useEffect(() => {
    const openComposer = () => {
      setComposerOpen(true);
      setAutoFocusSearch(true);
      setSearchFocusSignal((value) => value + 1);
    };
    window.addEventListener("ottline:quick-log", openComposer);
    return () => window.removeEventListener("ottline:quick-log", openComposer);
  }, []);

  const handleComposerOpenChange = useCallback((open: boolean) => {
    setComposerOpen(open);
    if (!open) {
      setSharedQuery("");
      setSharedPlatform("");
      setShareImportStatus(null);
      setActivationTitleSelection(null);
      setHighlightedStatus(null);
    }
  }, []);

  const hideActivationCurrent = useCallback(() => {
    setActivationDismissed(true);
  }, []);

  const dismissActivationForSession = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(ACTIVATION_DISMISSED_KEY, "1");
    }
    setActivationDismissed(true);
    void trackEvent("activation_dismiss", {
      contentType: activationContentType,
    });
  }, [activationContentType]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setActivationDismissed(
      window.sessionStorage.getItem(ACTIVATION_DISMISSED_KEY) === "1",
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    refreshProfilePromptState();

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const quickEnabled = params.get("quick") === "1";
      const quickTypeParam = params.get("quick_type");
      const quickFocus = params.get("quick_focus") === "1";
      const captureTitle = params.get("capture_title")?.trim();
      const captureType = params.get("capture_type");
      const capturePlatform =
        platformFromCaptureKey(
          params.get("capture_platform_key")?.trim(),
          tQuick,
        ) ?? params.get("capture_platform")?.trim();
      const fromWatchReminder =
        params.get("source") === "android-watch-reminder";
      const rawShared = [params.get("shared_text"), params.get("shared_url")]
        .filter((v): v is string => Boolean(v?.trim()))
        .join("\n");
      const rawSubject = params.get("shared_subject");
      const hasSharedInput = Boolean(rawShared.trim() || rawSubject?.trim());

      if (!cancelled) {
        const shouldOpenComposer =
          quickEnabled ||
          quickFocus ||
          Boolean(captureTitle) ||
          Boolean(captureType) ||
          Boolean(capturePlatform) ||
          fromWatchReminder ||
          hasSharedInput;
        setActivationForcedBypass(shouldOpenComposer);
        if (shouldOpenComposer) setComposerOpen(true);
      }

      if (quickEnabled) {
        if (!cancelled) {
          if (quickTypeParam === "book" || quickTypeParam === "video") {
            setQuickType(quickTypeParam);
          }
          if (quickFocus) {
            setAutoFocusSearch(true);
          }
        }
      }

      if (!cancelled) {
        if (captureType === "book" || captureType === "video") {
          setSharedContentType(captureType);
          setQuickType(captureType);
        }
        if (capturePlatform) {
          setSharedPlatform(capturePlatform);
        }
        if (fromWatchReminder) {
          setAutoFocusSearch(true);
        }
      }

      if (captureTitle && !cancelled) {
        setSharedQuery(captureTitle);
        setShareImportStatus("imported");
        setAutoFocusSearch(true);
      }

      const platform = inferShareIntentPlatform(rawShared, rawSubject);
      if (platform && !cancelled) setSharedPlatform(platform);
      const parsed = parseShareIntentText(rawShared, rawSubject);
      if (parsed) {
        if (!cancelled) {
          setSharedQuery(parsed.query);
          setSharedContentType(parsed.contentType);
          setShareImportStatus("imported");
        }
        return;
      }

      const firstUrl = extractShareIntentUrls(rawShared, rawSubject)[0];
      if (!firstUrl) {
        if (hasSharedInput && !cancelled) {
          setShareImportStatus("unresolved");
          setAutoFocusSearch(true);
        }
        return;
      }
      try {
        const r = await fetch(
          `/share-resolve?url=${encodeURIComponent(firstUrl)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );
        if (!r.ok) return;
        const data = (await r.json()) as { title?: string | null };
        const title = sanitizeResolvedTitle(data.title);
        if (!title) {
          if (!cancelled) {
            setShareImportStatus("unresolved");
            setAutoFocusSearch(true);
          }
          return;
        }
        if (cancelled) return;
        setSharedQuery(title.slice(0, 160));
        setSharedContentType("video");
        setShareImportStatus("imported");
      } catch {
        if (!cancelled) {
          setShareImportStatus("unresolved");
          setAutoFocusSearch(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshProfilePromptState, tQuick]);

  const loadDiscussions = useCallback(async () => {
    setDiscussionsLoading(true);
    setDiscussionsError(false);
    try {
      const latest = await api<DiscussionListItem[]>(
        `/discussions/latest?limit=${HOME_DISCUSSION_LIMIT}&days=14`,
      );
      setDiscussions(latest);
      const missingCount = Math.max(0, HOME_DISCUSSION_LIMIT - latest.length);
      const latestVideo = latest.filter(
        (item) => item.titleType === "movie" || item.titleType === "series",
      );
      const activationMissingCount = Math.max(
        0,
        HOME_DISCUSSION_LIMIT - latestVideo.length,
      );

      if (missingCount === 0 && activationMissingCount === 0) {
        setTrendingTitles([]);
        setActivationPopularTitles([]);
        return;
      }

      try {
        const trends = await api<TitleSearchItem[]>(
          `/titles/popular?limit=${HOME_DISCUSSION_LIMIT * 2}`,
        );
        setTrendingTitles(
          selectPopularTitleFillers(latest, trends, missingCount),
        );
        setActivationPopularTitles(
          selectPopularTitleFillers(
            latestVideo,
            trends,
            activationMissingCount,
          ),
        );
      } catch {
        setDiscussionsError(true);
        setTrendingTitles([]);
        setActivationPopularTitles([]);
      }
    } catch {
      setDiscussionsError(true);
      setDiscussions([]);
      setTrendingTitles([]);
      setActivationPopularTitles([]);
    } finally {
      setDiscussionsLoading(false);
    }
  }, []);

  const handleTrendingSelect = useCallback((item: TitleSearchItem) => {
    setSharedQuery(item.name);
    setSharedContentType("video");
    setQuickType("video");
    setSharedPlatform("");
    setShareImportStatus(null);
    setAutoFocusSearch(true);
    setComposerOpen(true);
    setSearchFocusSignal((value) => value + 1);
  }, []);

  const handleActivationVideoSelect = useCallback(
    (
      item: TitleSearchItem,
      source: Extract<
        TitleSelectSource,
        "activation_recent_discussion" | "activation_popular_title"
      >,
    ) => {
      setQuickType("video");
      setHighlightedStatus(null);
      setSharedQuery("");
      setSharedPlatform("");
      setShareImportStatus(null);
      hideActivationCurrent();
      setActivationSelectionNonce((nonce) => {
        const next = nonce + 1;
        setActivationTitleSelection({ item, source, nonce: next });
        return next;
      });
      focusQuickLog();
    },
    [focusQuickLog, hideActivationCurrent],
  );

  const handleActivationBookStatusSelect = useCallback(
    (status: Status) => {
      setActivationContentType("book");
      setQuickType("book");
      setHighlightedStatus(status);
      setSharedQuery("");
      setSharedPlatform("");
      setShareImportStatus(null);
      hideActivationCurrent();
      setAutoFocusSearch(true);
      setSearchFocusSignal((value) => value + 1);
      focusQuickLog();
    },
    [focusQuickLog, hideActivationCurrent],
  );

  const handleActivationFindOther = useCallback(
    (type: ActivationContentType) => {
      setActivationContentType(type);
      setQuickType(type);
      setHighlightedStatus(null);
      setSharedQuery("");
      setSharedPlatform("");
      setShareImportStatus(null);
      hideActivationCurrent();
      setAutoFocusSearch(true);
      setSearchFocusSignal((value) => value + 1);
      focusQuickLog();
    },
    [focusQuickLog, hideActivationCurrent],
  );

  const handleQuickTypeChange = useCallback((type: "video" | "book") => {
    setQuickType(type);
    if (type === "video") setHighlightedStatus(null);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const cached = await listAllLogsLocal();
        if (cached.length > 0) setLogs(cached);
        await refreshActivationEligibility();

        if (getUserId()) {
          const l = await apiWithAuth<WatchLog[]>("/logs?limit=8");
          await upsertLogsLocal(l);
          const refreshed = await listAllLogsLocal();
          if (refreshed.length > 0) setLogs(refreshed);
          await refreshActivationEligibility();
        }
      } catch {
        // keep cached logs if network fails
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshActivationEligibility]);

  useEffect(() => {
    loadDiscussions();
  }, [loadDiscussions]);

  useEffect(() => {
    function handleSync() {
      listAllLogsLocal().then((cached) => setLogs(cached));
      loadDiscussions();
      refreshProfilePromptState();
      void refreshActivationEligibility();
    }
    window.addEventListener("sync:updated", handleSync);
    window.addEventListener("auth:changed", handleSync);
    window.addEventListener("auth:revoked", handleSync);
    return () => {
      window.removeEventListener("sync:updated", handleSync);
      window.removeEventListener("auth:changed", handleSync);
      window.removeEventListener("auth:revoked", handleSync);
    };
  }, [
    loadDiscussions,
    refreshActivationEligibility,
    refreshProfilePromptState,
  ]);

  const showProfilePrompt =
    logs.length > 0 &&
    hasAccount &&
    !profilePromptHidden &&
    !isProfileComplete(profile);
  const activationRecentVideoItems = discussions
    .filter((item) => item.titleType === "movie" || item.titleType === "series")
    .slice(0, HOME_DISCUSSION_LIMIT);
  const showActivationPanel =
    activationEligible &&
    !activationDismissed &&
    !activationForcedBypass &&
    (discussionsLoading ||
      activationContentType === "book" ||
      activationRecentVideoItems.length > 0 ||
      activationPopularTitles.length > 0);
  return (
    <>
      <SoftwareApplicationJsonLd
        locale={locale}
        description={tMetadata("description")}
      />
      <HomeTimelineView
        logs={logs}
        loading={loading}
        onRecord={focusQuickLog}
        onShare={(log) => {
          setShareLog(log);
          setShareOpen(true);
        }}
      />
      {showActivationPanel && !loading ? (
        <div className={styles.activation}>
          <FirstLogActivationPanel
            contentType={activationContentType}
            recentVideoItems={activationRecentVideoItems}
            popularVideoItems={activationPopularTitles}
            loading={discussionsLoading}
            onContentTypeChange={setActivationContentType}
            onDismiss={dismissActivationForSession}
            onVideoSelect={handleActivationVideoSelect}
            onBookStatusSelect={handleActivationBookStatusSelect}
            onFindOther={handleActivationFindOther}
          />
        </div>
      ) : null}
      <QuickLogDialog
        open={composerOpen}
        onOpenChange={handleComposerOpenChange}
        onCreated={async (created, options) => {
          setActivationEligible(false);
          setLogs((prev) => {
            const idx = prev.findIndex((log) => log.id === created.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = created;
              return next;
            }
            return [created, ...prev];
          });
          await upsertLogsLocal([created]);
          await refreshActivationEligibility();
          await loadDiscussions();
          if (options?.shareCard) {
            setShareLog(created);
            setShareOpen(true);
          }
        }}
        onContentTypeChange={handleQuickTypeChange}
        initialContentType={sharedQuery ? sharedContentType : quickType}
        initialSearchQuery={sharedQuery}
        initialPlatform={sharedPlatform}
        autoFocusSearch={autoFocusSearch}
        searchFocusSignal={searchFocusSignal}
        shareImportStatus={shareImportStatus}
        shareImportFeedbackHref={feedbackHref("android-alpha-share")}
        activationTitleSelection={activationTitleSelection}
        highlightedStatus={highlightedStatus}
      />
      {!loading && logs.length > 0 ? (
        <div className="mt-8">
          <AndroidWatchReminderCard />
        </div>
      ) : null}
      {showProfilePrompt ? (
        <div className="mt-8">
          <ProfilePromptCard
            onDismiss={() => {
              dismissProfilePrompt();
              refreshProfilePromptState();
            }}
          />
        </div>
      ) : null}
      <section className={styles.publicSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>
              {locale === "ko" ? "함께" : "TOGETHER"}
            </p>
            <h2 className="flex items-center gap-2">
              <MessageCircle size={19} aria-hidden="true" />
              {locale === "ko" ? "함께 만나는 이야기" : "Stories to share"}
            </h2>
          </div>
          <Link href="/public" className={styles.quietLink}>
            {tHome("viewAll")}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        {discussionsLoading &&
        discussions.length === 0 &&
        trendingTitles.length === 0 ? (
          <div>
            <output className="sr-only">{tHome("loading")}</output>
            <DiscussionsSkeleton />
          </div>
        ) : discussionsError &&
          discussions.length === 0 &&
          trendingTitles.length === 0 ? (
          <div className={styles.publicError} role="status">
            <p>
              {locale === "ko"
                ? "함께 남긴 이야기를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요."
                : "Couldn’t load the shared stories. Please try again in a moment."}
            </p>
            <button
              type="button"
              className={styles.quietLink}
              onClick={() => void loadDiscussions()}
            >
              {locale === "ko" ? "다시 불러오기" : "Try again"}
            </button>
          </div>
        ) : (
          <DiscussionList
            items={discussions}
            trendingItems={trendingTitles}
            onTrendingSelect={handleTrendingSelect}
          />
        )}
      </section>
      <ShareBottomSheet
        open={shareOpen}
        log={shareLog}
        onClose={() => setShareOpen(false)}
      />
    </>
  );
}
