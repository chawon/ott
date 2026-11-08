"use client";

import { ArrowRight, BookOpen, MessageSquare, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/routing";
import { api, apiWithAuth } from "@/lib/api";
import { isKdcBookshelfLocale, type KdcMajor } from "@/lib/bookshelf";
import { recordDisplayYear } from "@/lib/recordMetadata";
import type {
  BookClassification,
  Comment,
  CreateCommentRequest,
  Discussion,
  WatchLog,
} from "@/lib/types";
import { formatNoteInline, statusLabel } from "@/lib/utils";
import {
  RecordEdition,
  RecordFeeling,
  RecordMoment,
  RecordPoster,
  recordDate,
} from "./timeline-v2/RecordParts";
import styles from "./timeline-v2/timeline.module.css";

function renderBody(text: string) {
  const parts = text.split(/(@\{[^}]+\})/g);
  let offset = 0;
  return parts.map((p) => {
    const key = `${offset}:${p}`;
    offset += p.length;
    if (p.startsWith("@{") && p.endsWith("}")) {
      const name = p.slice(2, -1);
      return (
        <span
          key={key}
          className="rounded-md bg-accent px-1 text-accent-foreground"
        >
          @{name}
        </span>
      );
    }
    if (p.startsWith("@")) {
      return (
        <span
          key={key}
          className="rounded-md bg-accent px-1 text-accent-foreground"
        >
          {p}
        </span>
      );
    }
    return <span key={key}>{p}</span>;
  });
}

export default function LogCard({
  log,
  onShareCard,
  bookClassification,
}: {
  log: WatchLog;
  onShareCard?: () => void;
  bookClassification?: BookClassification | null;
}) {
  const t = log.title;
  const locale = useLocale();
  const ko = locale === "ko";
  const tStatus = useTranslations("Status");
  const tQuick = useTranslations("QuickLogCard");
  const tBookshelf = useTranslations("Bookshelf");
  const [isSharing, setIsSharing] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [shareError, setShareError] = useState(false);
  if (log.deletedAt || !t?.id) return null;
  const displayYear = recordDisplayYear(t, log);

  async function handleSharePublic() {
    if (isSharing || isShared) return;
    setIsSharing(true);
    setShareError(false);
    try {
      const discussion = await api<Discussion>("/discussions", {
        method: "POST",
        body: JSON.stringify({ titleId: t.id }),
      });
      if (log.note?.trim()) {
        const req: CreateCommentRequest = {
          body: log.note.trim(),
          mentions: [],
          syncLog: false,
        };
        await apiWithAuth<Comment>(`/discussions/${discussion.id}/comments`, {
          method: "POST",
          body: JSON.stringify(req),
        });
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sync:updated"));
      }
      setIsShared(true);
    } catch {
      setShareError(true);
    } finally {
      setIsSharing(false);
    }
  }

  const date = recordDate(log);
  const kdcMajor =
    bookClassification?.status === "RESOLVED" &&
    typeof bookClassification.kdcMajor === "number"
      ? (bookClassification.kdcMajor as KdcMajor)
      : null;

  return (
    <article
      className={styles.recordRow}
      data-testid="timeline-record"
      data-log-id={log.id}
    >
      <time
        className={styles.recordDate}
        dateTime={log.watchedAt || log.createdAt}
      >
        {date ? (
          <>
            <span>
              {date.toLocaleDateString(ko ? "ko-KR" : "en-US", {
                month: "short",
              })}
            </span>
            <strong>{date.getDate()}</strong>
          </>
        ) : (
          <span>{ko ? "날짜 없음" : "Undated"}</span>
        )}
        {!log.watchedAt ? <small>{ko ? "기록한 날" : "Added"}</small> : null}
      </time>
      <RecordPoster log={log} />
      <div className={styles.recordContent}>
        <div className={styles.recordMeta}>
          <span>
            {t.type === "book"
              ? tQuick("typeBook")
              : t.type === "series"
                ? tQuick("typeSeriesModern")
                : tQuick("typeMovie")}
            {displayYear ? ` · ${displayYear}` : ""}
          </span>
          <RecordEdition log={log} />
          {log.origin === "COMMENT" ? (
            <span>{ko ? "함께 남긴 기록" : "From a conversation"}</span>
          ) : null}
          {log.syncStatus === "pending" || log.syncStatus === "failed" ? (
            <span>{ko ? "이 기기에 보관 중" : "Kept on this device"}</span>
          ) : null}
        </div>
        <Link href={`/title/${t.id}`} className={styles.recordTitle}>
          {t.name}
        </Link>
        <div className={styles.recordState}>
          <span>{statusLabel(log.status, t.type, tStatus)}</span>
          <RecordFeeling log={log} />
        </div>
        <RecordMoment log={log} />
        {log.note?.trim() ? (
          <p className={styles.recordNote}>
            {renderBody(formatNoteInline(log.note))}
          </p>
        ) : null}
        <div className={styles.recordActions}>
          <Link href={`/title/${t.id}`}>
            {ko ? "기록 펼치기" : "Open record"}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          {onShareCard ? (
            <button type="button" onClick={onShareCard}>
              <Share2 size={15} aria-hidden="true" />
              {tQuick("createShareCard")}
            </button>
          ) : null}
          {log.note?.trim() ? (
            <button
              type="button"
              onClick={() => void handleSharePublic()}
              disabled={isSharing || isShared}
            >
              <MessageSquare size={15} aria-hidden="true" />
              {isShared
                ? ko
                  ? "함께 나눴어요"
                  : "Shared with everyone"
                : isSharing
                  ? ko
                    ? "공유 중"
                    : "Sharing"
                  : tQuick("shareToPublic")}
            </button>
          ) : null}
          {isKdcBookshelfLocale(locale) &&
          t.type === "book" &&
          kdcMajor !== null ? (
            <Link href={`/me/bookshelf?kdc=${kdcMajor}`}>
              <BookOpen size={15} aria-hidden="true" />
              {tBookshelf("shelfBadge", {
                code: bookClassification?.kdcCode ?? `${kdcMajor}00`,
                category: tBookshelf(`categories.${kdcMajor}`),
              })}
            </Link>
          ) : null}
        </div>
        {shareError ? (
          <p className={styles.recordError} role="status">
            {ko
              ? "공유하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요."
              : "Couldn’t share this record. Check your connection and try again."}
          </p>
        ) : null}
      </div>
    </article>
  );
}
