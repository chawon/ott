"use client";

import { MessageCircle, NotebookPen, PencilLine } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import DiscussionList from "@/components/DiscussionList";
import LogCard from "@/components/LogCard";
import QuickLogCard from "@/components/QuickLogCard";
import ShareBottomSheet from "@/components/ShareBottomSheet";
import { api, apiWithAuth } from "@/lib/api";
import { getUserId, listLogsLocal, upsertLogsLocal } from "@/lib/localStore";
import {
  extractShareIntentUrls,
  inferShareIntentPlatform,
  parseShareIntentText,
  sanitizeResolvedTitle,
} from "@/lib/shareIntent";
import type { DiscussionListItem, WatchLog } from "@/lib/types";

export default function HomePage() {
  const tHome = useTranslations("HomePage");
  const [logs, setLogs] = useState<WatchLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [discussions, setDiscussions] = useState<DiscussionListItem[]>([]);
  const [quickType, setQuickType] = useState<"video" | "book">("video");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLog, setShareLog] = useState<WatchLog | null>(null);
  const [sharedQuery, setSharedQuery] = useState<string>("");
  const [sharedContentType, setSharedContentType] = useState<"video" | "book">(
    "video",
  );
  const [sharedPlatform, setSharedPlatform] = useState<string>("");
  const [autoFocusSearch, setAutoFocusSearch] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

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
        setAutoFocusSearch(true);
        if (captureType === "book" || captureType === "video") {
          setSharedContentType(captureType);
          setQuickType(captureType);
        }
        if (capturePlatform) {
          setSharedPlatform(capturePlatform);
        }
      }

      const rawShared = params.get("shared_text");
      const rawSubject = params.get("shared_subject");
      const platform = inferShareIntentPlatform(rawShared, rawSubject);
      if (platform && !cancelled) setSharedPlatform(platform);
      const parsed = parseShareIntentText(rawShared, rawSubject);
      if (parsed) {
        if (!cancelled) {
          setSharedQuery(parsed.query);
          setSharedContentType(parsed.contentType);
        }
        return;
      }

      const firstUrl = extractShareIntentUrls(rawShared, rawSubject)[0];
      if (!firstUrl) return;
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
        if (!title || cancelled) return;
        setSharedQuery(title.slice(0, 160));
        setSharedContentType("video");
      } catch {
        // ignore resolver failures
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadDiscussions = useCallback(async () => {
    try {
      const latest = await api<DiscussionListItem[]>(
        "/discussions/latest?limit=6&days=14",
      );
      setDiscussions(latest);
    } catch {
      setDiscussions([]);
    }
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
    }
    window.addEventListener("sync:updated", handleSync);
    return () => window.removeEventListener("sync:updated", handleSync);
  }, [loadDiscussions]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <PencilLine className="h-4 w-4" />
                {quickType === "book"
                  ? tHome("heroTimelineBook")
                  : tHome("heroTimelineVideo")}
              </h1>
              <p className="text-sm text-muted-foreground ml-6">
                {tHome("heroTimelineDesc")}
              </p>
            </div>
          </div>
          <QuickLogCard
            onCreated={async (created, options) => {
              setLogs((prev) => [created, ...prev].slice(0, 8));
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
          />
        </section>
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <div className="text-base font-semibold flex items-center gap-2">
              <NotebookPen className="h-4 w-4" />
              {tHome("myRecords")}
            </div>
            <Link
              href="/timeline"
              className="text-sm text-neutral-700 hover:underline"
            >
              {tHome("viewAll")}
            </Link>
          </div>

          {loading && logs.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
              {tHome("loading")}
            </div>
          ) : null}

          {!loading && logs.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
              {tHome("emptyRecords")}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3">
            {logs.map((l) => (
              <LogCard key={l.id} log={l} />
            ))}
          </div>
        </section>
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
        <DiscussionList items={discussions} />
      </aside>
      <ShareBottomSheet
        open={shareOpen}
        log={shareLog}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
