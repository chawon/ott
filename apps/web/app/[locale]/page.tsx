"use client";

import { MessageCircle, NotebookPen, PencilLine } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import DiscussionList from "@/components/DiscussionList";
import LogCard from "@/components/LogCard";
import ProfileAvatar from "@/components/ProfileAvatar";
import ProfilePromptCard from "@/components/ProfilePromptCard";
import QuickLogCard from "@/components/QuickLogCard";
import ShareBottomSheet from "@/components/ShareBottomSheet";
import { api, apiWithAuth } from "@/lib/api";
import {
  dismissProfilePrompt,
  getDeviceId,
  getUserId,
  isProfilePromptDismissed,
  listLogsLocal,
  upsertLogsLocal,
} from "@/lib/localStore";
import { isProfileComplete } from "@/lib/profile";
import {
  extractShareIntentUrls,
  inferShareIntentPlatform,
  parseShareIntentText,
  sanitizeResolvedTitle,
} from "@/lib/shareIntent";
import type {
  DiscussionListItem,
  TitleSearchItem,
  WatchLog,
} from "@/lib/types";
import { useUserProfile } from "@/lib/useUserProfile";

type ShareImportStatus = "imported" | "unresolved";
const HOME_DISCUSSION_LIMIT = 6;

function titleFallbackKey({
  type,
  name,
  year,
}: {
  type: string;
  name: string;
  year?: number | null;
}) {
  return `${type}:${name.trim().toLowerCase()}:${year ?? ""}`;
}

function selectTrendingFillers(
  discussions: DiscussionListItem[],
  trends: TitleSearchItem[],
  limit: number,
) {
  const providerKeys = new Set(
    discussions
      .map((item) =>
        item.titleProvider && item.titleProviderId
          ? `${item.titleProvider}:${item.titleProviderId}`
          : null,
      )
      .filter((key): key is string => Boolean(key)),
  );
  const fallbackKeys = new Set(
    discussions.map((item) =>
      titleFallbackKey({
        type: item.titleType,
        name: item.titleName,
        year: item.titleYear,
      }),
    ),
  );
  const selected: TitleSearchItem[] = [];

  for (const item of trends) {
    if (selected.length >= limit) break;
    const providerKey = `${item.provider}:${item.providerId}`;
    const fallbackKey = titleFallbackKey(item);
    if (providerKeys.has(providerKey) || fallbackKeys.has(fallbackKey)) {
      continue;
    }
    providerKeys.add(providerKey);
    fallbackKeys.add(fallbackKey);
    selected.push(item);
  }

  return selected;
}

function feedbackHref(source: string) {
  const params = new URLSearchParams({ source });
  return `/feedback?${params.toString()}`;
}

function RecentLogsSkeleton() {
  const rows = [
    "home-log-skeleton-1",
    "home-log-skeleton-2",
    "home-log-skeleton-3",
    "home-log-skeleton-4",
    "home-log-skeleton-5",
    "home-log-skeleton-6",
    "home-log-skeleton-7",
    "home-log-skeleton-8",
  ];

  return (
    <div className="grid grid-cols-1 gap-3" aria-hidden="true">
      {rows.map((row) => (
        <div
          key={row}
          className="min-h-[193px] rounded-2xl border border-border bg-card p-5 shadow-sm sm:min-h-[170px]"
        >
          <div className="flex gap-3">
            <div className="h-32 w-20 shrink-0 rounded-xl bg-muted animate-pulse" />
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
  const tHome = useTranslations("HomePage");
  const tProfile = useTranslations("Profile");
  const [logs, setLogs] = useState<WatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [discussions, setDiscussions] = useState<DiscussionListItem[]>([]);
  const [trendingTitles, setTrendingTitles] = useState<TitleSearchItem[]>([]);
  const [discussionsLoading, setDiscussionsLoading] = useState(true);
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
  const { profile } = useUserProfile();

  const refreshProfilePromptState = useCallback(() => {
    setHasAccount(Boolean(getUserId() && getDeviceId()));
    setProfilePromptHidden(isProfilePromptDismissed());
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
      const capturePlatform = params.get("capture_platform")?.trim();

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

      if (captureTitle && !cancelled) {
        setSharedQuery(captureTitle);
        setShareImportStatus("imported");
        setAutoFocusSearch(true);
        if (captureType === "book" || captureType === "video") {
          setSharedContentType(captureType);
          setQuickType(captureType);
        }
        if (capturePlatform) {
          setSharedPlatform(capturePlatform);
        }
      }

      const rawShared = [params.get("shared_text"), params.get("shared_url")]
        .filter((v): v is string => Boolean(v?.trim()))
        .join("\n");
      const rawSubject = params.get("shared_subject");
      const hasSharedInput = Boolean(rawShared.trim() || rawSubject?.trim());
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
  }, [refreshProfilePromptState]);

  const loadDiscussions = useCallback(async () => {
    setDiscussionsLoading(true);
    try {
      const latest = await api<DiscussionListItem[]>(
        `/discussions/latest?limit=${HOME_DISCUSSION_LIMIT}&days=14`,
      );
      setDiscussions(latest);
      const missingCount = Math.max(0, HOME_DISCUSSION_LIMIT - latest.length);
      if (missingCount === 0) {
        setTrendingTitles([]);
        return;
      }

      try {
        const trends = await api<TitleSearchItem[]>(
          `/titles/popular?limit=${HOME_DISCUSSION_LIMIT * 2}`,
        );
        setTrendingTitles(selectTrendingFillers(latest, trends, missingCount));
      } catch {
        setTrendingTitles([]);
      }
    } catch {
      setDiscussions([]);
      setTrendingTitles([]);
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const cached = await listLogsLocal({ limit: 8 });
        if (cached.length > 0) setLogs(cached);

        if (getUserId()) {
          const l = await apiWithAuth<WatchLog[]>("/logs?limit=8");
          await upsertLogsLocal(l);
          const refreshed = await listLogsLocal({ limit: 8 });
          if (refreshed.length > 0) setLogs(refreshed);
        }
      } catch {
        // keep cached logs if network fails
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    loadDiscussions();
  }, [loadDiscussions]);

  useEffect(() => {
    function handleSync() {
      listLogsLocal({ limit: 8 }).then((cached) => setLogs(cached));
      loadDiscussions();
      refreshProfilePromptState();
    }
    window.addEventListener("sync:updated", handleSync);
    return () => window.removeEventListener("sync:updated", handleSync);
  }, [loadDiscussions, refreshProfilePromptState]);

  const showProfilePrompt =
    logs.length > 0 &&
    hasAccount &&
    !profilePromptHidden &&
    !isProfileComplete(profile);
  const profileComplete = isProfileComplete(profile);
  const nickname = profile?.nickname ?? "";
  const heroTitle =
    quickType === "book"
      ? profileComplete
        ? tHome("heroTimelineBookPersonalized", { nickname })
        : tHome("heroTimelineBook")
      : profileComplete
        ? tHome("heroTimelineVideoPersonalized", { nickname })
        : tHome("heroTimelineVideo");
  const heroDescription =
    profileComplete && profile?.personaKey
      ? tHome("heroTimelineProfileDesc", {
          persona: tProfile(`personas.${profile.personaKey}`),
        })
      : tHome("heroTimelineDesc");
  const recordsTitle = profileComplete
    ? tHome("myRecordsPersonalized", { nickname })
    : tHome("myRecords");

  return (
    <div className="grid min-h-[calc(100dvh-12rem)] grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {profileComplete ? (
                <ProfileAvatar
                  personaKey={profile?.personaKey}
                  size={52}
                  alt=""
                />
              ) : null}
              <div className="min-w-0 space-y-1">
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  {!profileComplete ? <PencilLine className="h-4 w-4" /> : null}
                  <span className="truncate">{heroTitle}</span>
                </h1>
                <p
                  className={
                    profileComplete
                      ? "text-sm text-muted-foreground"
                      : "text-sm text-muted-foreground ml-6"
                  }
                >
                  {heroDescription}
                </p>
              </div>
            </div>
          </div>
          <QuickLogCard
            onCreated={async (created, options) => {
              setLogs((prev) => {
                const idx = prev.findIndex((l) => l.id === created.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = created;
                  return next;
                }
                return [created, ...prev].slice(0, 8);
              });
              await upsertLogsLocal([created]);
              await loadDiscussions();
              if (options?.shareCard) {
                setShareLog(created);
                setShareOpen(true);
              }
            }}
            onContentTypeChange={setQuickType}
            initialContentType={sharedQuery ? sharedContentType : quickType}
            initialSearchQuery={sharedQuery}
            initialPlatform={sharedPlatform}
            autoFocusSearch={autoFocusSearch}
            shareImportStatus={shareImportStatus}
            shareImportFeedbackHref={feedbackHref("android-alpha-share")}
          />
        </section>
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <div className="text-base font-semibold flex items-center gap-2">
              <NotebookPen className="h-4 w-4" />
              {recordsTitle}
            </div>
            <Link
              href="/timeline"
              className="text-sm text-neutral-700 hover:underline"
            >
              {tHome("viewAll")}
            </Link>
          </div>

          {loading && logs.length === 0 ? (
            <div>
              <output className="sr-only">{tHome("loading")}</output>
              <RecentLogsSkeleton />
            </div>
          ) : null}

          {!loading && logs.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
              {tHome("emptyRecords")}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3">
            {logs.map((l) => (
              <LogCard
                key={l.id}
                log={l}
                onShareCard={() => {
                  setShareLog(l);
                  setShareOpen(true);
                }}
              />
            ))}
          </div>
        </section>
        {showProfilePrompt ? (
          <ProfilePromptCard
            onDismiss={() => {
              dismissProfilePrompt();
              refreshProfilePromptState();
            }}
          />
        ) : null}
      </div>

      <aside className="space-y-3">
        <div className="flex items-end justify-between min-h-[52px]">
          <div className="text-base font-semibold flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            {tHome("publicTitleModern")}
          </div>
          <Link
            href="/public"
            className="text-sm text-neutral-700 hover:underline"
          >
            {tHome("viewAll")}
          </Link>
        </div>
        {discussionsLoading &&
        discussions.length === 0 &&
        trendingTitles.length === 0 ? (
          <div>
            <output className="sr-only">{tHome("loading")}</output>
            <DiscussionsSkeleton />
          </div>
        ) : (
          <DiscussionList
            items={discussions}
            trendingItems={trendingTitles}
            onTrendingSelect={handleTrendingSelect}
          />
        )}
      </aside>
      <ShareBottomSheet
        open={shareOpen}
        log={shareLog}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
