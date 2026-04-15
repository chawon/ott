"use client";

import { ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type {
  CreateFeedbackMessageRequest,
  FeedbackThreadDetail,
  FeedbackThreadSummary,
} from "@/lib/types";
import { buildApiUrl } from "@/lib/url";
import { cn } from "@/lib/utils";

type Props = {
  token: string;
};

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleString(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function adminFetch<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(buildApiUrl(`/admin/feedback${path}`), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Token": token,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

export default function AdminFeedbackConsole({ token }: Props) {
  const t = useTranslations("AdminFeedback");
  const locale = useLocale();
  const [threads, setThreads] = useState<FeedbackThreadSummary[]>([]);
  const [detail, setDetail] = useState<FeedbackThreadDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setStatus(null);
      try {
        const items = await adminFetch<FeedbackThreadSummary[]>(
          token,
          "/threads?limit=100",
        );
        if (cancelled) return;
        setThreads(items);
        const initialId = items[0]?.id ?? null;
        setSelectedId(initialId);
        if (initialId) {
          const next = await adminFetch<FeedbackThreadDetail>(
            token,
            `/threads/${initialId}`,
          );
          if (!cancelled) setDetail(next);
        } else {
          setDetail(null);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setStatus(errorMessage(error, t("loadError")));
          setThreads([]);
          setDetail(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function openThread(id: string) {
    setSelectedId(id);
    try {
      const next = await adminFetch<FeedbackThreadDetail>(token, `/threads/${id}`);
      setDetail(next);
    } catch (error: unknown) {
      setStatus(errorMessage(error, t("loadDetailError")));
    }
  }

  async function reload(selected?: string | null) {
    const items = await adminFetch<FeedbackThreadSummary[]>(
      token,
      "/threads?limit=100",
    );
    setThreads(items);
    const nextId = selected ?? items[0]?.id ?? null;
    setSelectedId(nextId);
    if (nextId) {
      const next = await adminFetch<FeedbackThreadDetail>(
        token,
        `/threads/${nextId}`,
      );
      setDetail(next);
    } else {
      setDetail(null);
    }
  }

  async function submitReply() {
    if (!detail || !replyBody.trim() || submitting) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const payload: CreateFeedbackMessageRequest = { body: replyBody.trim() };
      await adminFetch<FeedbackThreadDetail>(token, `/threads/${detail.id}/reply`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setReplyBody("");
      await reload(detail.id);
      setStatus(t("replySuccess"));
    } catch (error: unknown) {
      setStatus(errorMessage(error, t("replyError")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        {status ? (
          <p className="text-xs font-medium text-blue-600">{status}</p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold">{t("allThreads")}</div>
          {loading ? (
            <div className="text-sm text-muted-foreground">{t("loading")}</div>
          ) : threads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              {t("empty")}
            </div>
          ) : (
            <div className="space-y-2">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => openThread(thread.id)}
                  className={cn(
                    "w-full rounded-2xl border px-3 py-3 text-left transition-colors",
                    selectedId === thread.id
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20"
                      : "border-border hover:bg-muted/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-indigo-600">
                      {t(`category.${thread.category}`)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {t(`status.${thread.status}`)}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-1 text-sm font-semibold text-foreground">
                    {thread.subject || t("untitled")}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {thread.lastMessagePreview || t("noMessages")}
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {thread.userId.slice(0, 8)} ·{" "}
                    {formatDate(thread.updatedAt, locale)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          {detail ? (
            <div className="space-y-4">
              <header className="space-y-1 border-b border-border pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/30">
                    {t(`category.${detail.category}`)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(`status.${detail.status}`)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    user {detail.userId.slice(0, 8)}
                  </span>
                </div>
                <div className="text-lg font-semibold">
                  {detail.subject || t("untitled")}
                </div>
              </header>

              <div className="space-y-3">
                {detail.messages.map((message) => {
                  const isAdmin = message.authorRole === "ADMIN";
                  return (
                    <article
                      key={message.id}
                      className={cn(
                        "rounded-2xl border px-4 py-3",
                        isAdmin
                          ? "border-emerald-100 bg-emerald-50/70 dark:bg-emerald-950/20"
                          : "border-border bg-muted/30",
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold">
                          {isAdmin
                            ? t("messageRoleAdmin")
                            : t("messageRoleUser")}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(message.createdAt, locale)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {message.body}
                      </p>
                    </article>
                  );
                })}
              </div>

              <section className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="mb-2 text-sm font-semibold">
                  {t("replyTitle")}
                </div>
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={t("replyPlaceholder")}
                  className="min-h-32 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={submitReply}
                    disabled={submitting || !replyBody.trim()}
                    className="rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-neutral-800 disabled:opacity-40"
                  >
                    {submitting ? t("replying") : t("replyAction")}
                  </button>
                </div>
              </section>
            </div>
          ) : (
            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
              {loading ? t("loading") : t("emptyDetail")}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
