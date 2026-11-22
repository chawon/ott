"use client";

import { Bookmark, BookOpen, CircleHelp, Eye } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { api, apiWithAuth } from "@/lib/api";
import {
  countLogsLocal,
  enqueueCreateLog,
  getDeviceId,
  getUserId,
  listLogsByTitleLocal,
  upsertLogLocal,
} from "@/lib/localStore";
import { syncOutbox } from "@/lib/sync";
import type {
  DiscussionReactionState,
  DiscussionReactionSummary,
  DiscussionReactionType,
  Status,
  Title,
  TitleType,
  WatchLog,
} from "@/lib/types";
import { cn, safeUUID } from "@/lib/utils";

const EMPTY_SUMMARY: DiscussionReactionSummary = {
  done: 0,
  curious: 0,
  save: 0,
};

type TitleSnapshot = {
  id: string;
  name: string;
  type: TitleType;
  year?: number | null;
  posterUrl?: string | null;
};

type Props = {
  discussionId: string;
  title: TitleSnapshot;
  summary?: DiscussionReactionSummary | null;
  compact?: boolean;
  onSummaryChange?: (summary: DiscussionReactionSummary) => void;
};

function reactionStatus(type: DiscussionReactionType): Status {
  return type === "DONE" ? "DONE" : "WISHLIST";
}

function summaryCount(
  summary: DiscussionReactionSummary,
  type: DiscussionReactionType,
) {
  if (type === "DONE") return summary.done ?? 0;
  if (type === "CURIOUS") return summary.curious ?? 0;
  return summary.save ?? 0;
}

function titleFromSnapshot(snapshot: TitleSnapshot, now: string): Title {
  return {
    id: snapshot.id,
    type: snapshot.type,
    name: snapshot.name,
    year: snapshot.year ?? null,
    posterUrl: snapshot.posterUrl ?? null,
    updatedAt: now,
  };
}

export default function DiscussionReactionChips({
  discussionId,
  title,
  summary,
  compact = false,
  onSummaryChange,
}: Props) {
  const t = useTranslations("DiscussionReactions");
  const [currentSummary, setCurrentSummary] =
    useState<DiscussionReactionSummary>(summary ?? EMPTY_SUMMARY);
  const [selectedTypes, setSelectedTypes] = useState<DiscussionReactionType[]>(
    [],
  );
  const [pendingType, setPendingType] = useState<DiscussionReactionType | null>(
    null,
  );
  const [message, setMessage] = useState<{
    text: string;
    showLink: boolean;
  } | null>(null);

  useEffect(() => {
    setCurrentSummary(summary ?? EMPTY_SUMMARY);
  }, [summary]);

  useEffect(() => {
    if (compact) return;
    const userId = getUserId();
    const deviceId = getDeviceId();
    if (!userId || !deviceId) return;
    let cancelled = false;
    (async () => {
      try {
        const state = await api<DiscussionReactionState>(
          `/discussions/${discussionId}/reactions/me`,
        );
        if (cancelled) return;
        setCurrentSummary(state.summary);
        setSelectedTypes(state.selectedTypes ?? []);
        onSummaryChange?.(state.summary);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [compact, discussionId, onSummaryChange]);

  const items = useMemo(
    () => [
      {
        type: "DONE" as DiscussionReactionType,
        label: title.type === "book" ? t("doneBookLabel") : t("doneVideoLabel"),
        icon:
          title.type === "book" ? (
            <BookOpen className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          ),
      },
      {
        type: "CURIOUS" as DiscussionReactionType,
        label: t("curiousLabel"),
        icon: <CircleHelp className="h-3.5 w-3.5" />,
      },
      {
        type: "SAVE" as DiscussionReactionType,
        label: t("saveLabel"),
        icon: <Bookmark className="h-3.5 w-3.5" />,
      },
    ],
    [t, title.type],
  );

  async function ensureLocalRecord(type: DiscussionReactionType) {
    const existing = await listLogsByTitleLocal(title.id, 1);
    if (existing.length > 0) return "exists" as const;
    const logCountBeforeSave = await countLogsLocal();

    const now = new Date().toISOString();
    const logId = safeUUID();
    const localTitle = titleFromSnapshot(title, now);
    const status = reactionStatus(type);
    const log: WatchLog = {
      id: logId,
      title: localTitle,
      status,
      rating: null,
      note: null,
      spoiler: false,
      ott: null,
      seasonNumber: null,
      episodeNumber: null,
      seasonPosterUrl: null,
      seasonYear: null,
      origin: "LOG",
      watchedAt: now,
      place: null,
      occasion: null,
      createdAt: now,
      updatedAt: now,
      syncStatus: "pending",
    };

    await upsertLogLocal(log);
    await enqueueCreateLog({
      logId,
      titleId: title.id,
      updatedAt: now,
      log: {
        id: logId,
        op: "upsert",
        updatedAt: now,
        payload: {
          titleId: title.id,
          status,
          rating: null,
          note: null,
          ott: null,
          seasonNumber: null,
          episodeNumber: null,
          seasonPosterUrl: null,
          seasonYear: null,
          origin: "LOG",
          spoiler: false,
          watchedAt: now,
          place: null,
          occasion: null,
        },
      },
    });
    const logCreateProperties = {
      titleType: title.type,
      entryPoint: "public_reaction",
      reactionType: type,
      isFirstLog: logCountBeforeSave === 0,
    };
    await trackEvent("log_create", logCreateProperties);
    if (logCountBeforeSave === 0) {
      await trackEvent("first_log_create", logCreateProperties);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sync:updated"));
    }
    await syncOutbox();
    return "created" as const;
  }

  async function toggleReaction(type: DiscussionReactionType) {
    if (pendingType) return;
    setPendingType(type);
    setMessage(null);
    try {
      const state = await apiWithAuth<DiscussionReactionState>(
        `/discussions/${discussionId}/reactions`,
        {
          method: "PUT",
          body: JSON.stringify({ type }),
        },
      );
      setCurrentSummary(state.summary);
      setSelectedTypes(state.selectedTypes ?? []);
      onSummaryChange?.(state.summary);

      if (!state.selected) {
        setMessage({ text: t("removedMessage"), showLink: false });
        return;
      }

      const result = await ensureLocalRecord(type);
      setMessage({
        text:
          result === "created" ? t("savedMessage") : t("alreadyLoggedMessage"),
        showLink: true,
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : t("errorMessage"),
        showLink: false,
      });
    } finally {
      setPendingType(null);
    }
  }

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const selected = selectedTypes.includes(item.type);
          const count = summaryCount(currentSummary, item.type);
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => toggleReaction(item.type)}
              disabled={pendingType !== null}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
                selected
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                pendingType === item.type && "opacity-60",
              )}
              aria-pressed={selected}
            >
              {item.icon}
              <span>{item.label}</span>
              {!compact || count > 0 ? (
                <span className="tabular-nums">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {message ? (
        <div className="text-xs text-muted-foreground">
          {message.text}
          {message.showLink ? (
            <>
              {" "}
              <Link
                href={`/title/${title.id}`}
                className="font-medium underline"
              >
                {t("editLink")}
              </Link>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
