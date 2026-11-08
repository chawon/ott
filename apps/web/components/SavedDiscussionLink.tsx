"use client";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/routing";
import { normalizeBookIsbn13 } from "@/lib/bookshelf";
import { getDeviceId, getUserId, resolveLogLocal } from "@/lib/localStore";
import { getSyncState, subscribeSyncState } from "@/lib/sync";
import type {
  DiscussionConnection,
  Title,
  TitleSearchItem,
  WatchLog,
} from "@/lib/types";
import styles from "./recording.module.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A local ID may change in sync, but its external work/edition identity must not. */
function sameSavedTitle(saved: TitleSearchItem, resolved: Title) {
  if (saved.type !== resolved.type) return false;
  if (saved.type === "book") {
    const originalIsbn = normalizeBookIsbn13(saved);
    const resolvedIsbn = normalizeBookIsbn13(resolved);
    if (originalIsbn && resolvedIsbn) return originalIsbn === resolvedIsbn;
  }
  if (saved.provider && saved.providerId) {
    return (
      saved.provider === resolved.provider &&
      saved.providerId === resolved.providerId
    );
  }
  return saved.titleId === resolved.id;
}

export default function SavedDiscussionLink({
  record,
  sourceTitle,
  onOpen,
}: {
  record: WatchLog;
  sourceTitle: TitleSearchItem;
  onOpen?: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("QuickLogCard");
  const [revision, setRevision] = useState(0);
  const revisionRef = useRef(0);
  const [connection, setConnection] = useState<
    (DiscussionConnection & { scope: string }) | null
  >(null);
  const userId = getUserId();
  const deviceId = getDeviceId();
  const scope = JSON.stringify([
    record.id,
    record.title.id,
    sourceTitle.type,
    sourceTitle.provider,
    sourceTitle.providerId,
    sourceTitle.isbn10,
    sourceTitle.isbn13,
    userId,
    deviceId,
    locale,
  ]);

  useEffect(() => {
    const refresh = () => {
      revisionRef.current += 1;
      setRevision(revisionRef.current);
    };
    const invalidate = () => {
      setConnection(null);
      refresh();
    };
    const storage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === "watchlog.userId" ||
        event.key === "watchlog.deviceId"
      )
        invalidate();
    };
    window.addEventListener("sync:updated", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", invalidate);
    window.addEventListener("auth:changed", invalidate);
    window.addEventListener("auth:revoked", invalidate);
    window.addEventListener("storage", storage);
    const unsubscribeSync = subscribeSyncState(refresh);
    return () => {
      window.removeEventListener("sync:updated", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", invalidate);
      window.removeEventListener("auth:changed", invalidate);
      window.removeEventListener("auth:revoked", invalidate);
      window.removeEventListener("storage", storage);
      unsubscribeSync();
    };
  }, []);

  useEffect(() => {
    if (
      !userId ||
      !deviceId ||
      !navigator.onLine ||
      getSyncState().status !== "idle"
    )
      return;
    const controller = new AbortController();
    let active = true;
    const isCurrent = () =>
      active &&
      revisionRef.current === revision &&
      !controller.signal.aborted &&
      getSyncState().status === "idle" &&
      navigator.onLine &&
      getUserId() === userId &&
      getDeviceId() === deviceId;
    const finish = (value: DiscussionConnection | null) => {
      if (isCurrent()) setConnection(value ? { ...value, scope } : null);
    };

    void (async () => {
      try {
        const current = await resolveLogLocal(record.id, record.title);
        if (!isCurrent()) return;
        if (
          !current ||
          current.deletedAt ||
          current.syncStatus !== "synced" ||
          !sameSavedTitle(sourceTitle, current.title)
        ) {
          finish(null);
          return;
        }
        const headers = new Headers({
          "X-User-Id": userId,
          "X-Device-Id": deviceId,
          "Accept-Language": locale,
        });
        if (window.location.hostname.endsWith(".ngrok-free.dev"))
          headers.set("ngrok-skip-browser-warning", "true");
        // This optional read must never register an account or reset local auth/data.
        const response = await fetch(
          `/api/discussions/connection?titleId=${encodeURIComponent(current.title.id)}`,
          {
            method: "GET",
            headers,
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          finish(null);
          return;
        }
        const text = await response.text();
        const data: unknown = text ? JSON.parse(text) : null;
        if (
          data &&
          typeof data === "object" &&
          "discussionId" in data &&
          typeof data.discussionId === "string" &&
          UUID.test(data.discussionId) &&
          "titleId" in data &&
          data.titleId === current.title.id
        )
          finish({
            discussionId: data.discussionId,
            titleId: current.title.id,
          });
        else finish(null);
      } catch {
        finish(null);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [record, sourceTitle, userId, deviceId, locale, scope, revision]);

  if (!connection || connection.scope !== scope || !navigator.onLine)
    return null;

  return (
    <div
      className={styles.discussionConnection}
      data-testid="saved-discussion-connection"
    >
      <p>{t("existingDiscussion")}</p>
      <Link
        href={`/public/${connection.discussionId}`}
        className={styles.quiet}
        onClick={onOpen}
        data-testid="saved-discussion-link"
      >
        {t("readExistingDiscussion")}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
      <p className={styles.hint}>{t("existingDiscussionPrivacy")}</p>
    </div>
  );
}
