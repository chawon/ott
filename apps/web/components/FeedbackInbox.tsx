"use client";

import { MailQuestion, MessagesSquare } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { api, ensureAuthIds } from "@/lib/api";
import type {
  CreateFeedbackThreadRequest,
  FeedbackCategory,
  FeedbackThreadDetail,
  FeedbackThreadSummary,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const categories: FeedbackCategory[] = ["QUESTION", "BUG", "IDEA", "OTHER"];

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

export default function FeedbackInbox() {
  const t = useTranslations("Feedback");
  const locale = useLocale();
  const [threads, setThreads] = useState<FeedbackThreadSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FeedbackThreadDetail | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>("QUESTION");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setStatus(null);
      try {
        await ensureAuthIds({ register: true });
        const items = await api<FeedbackThreadSummary[]>("/feedback/threads");
        if (cancelled) return;
        setThreads(items);
        const initialId = items[0]?.id ?? null;
        setSelectedId(initialId);
        if (initialId) {
          const next = await api<FeedbackThreadDetail>(
            `/feedback/threads/${initialId}`,
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

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function openThread(id: string) {
    setSelectedId(id);
    try {
      const next = await api<FeedbackThreadDetail>(`/feedback/threads/${id}`);
      setDetail(next);
    } catch (error: unknown) {
      setStatus(errorMessage(error, t("loadDetailError")));
    }
  }

  async function reloadThreads(selected?: string | null) {
    const items = await api<FeedbackThreadSummary[]>("/feedback/threads");
    setThreads(items);
    const nextId = selected ?? items[0]?.id ?? null;
    setSelectedId(nextId);
    if (nextId) {
      const next = await api<FeedbackThreadDetail>(
        `/feedback/threads/${nextId}`,
      );
      setDetail(next);
    } else {
      setDetail(null);
    }
  }

  async function submitThread() {
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const payload: CreateFeedbackThreadRequest = {
        category,
        subject: subject.trim() || null,
        body: body.trim(),
      };
      const created = await api<FeedbackThreadDetail>("/feedback/threads", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCategory("QUESTION");
      setSubject("");
      setBody("");
      await reloadThreads(created.id);
      setStatus(t("createSuccess"));
    } catch (error: unknown) {
      setStatus(errorMessage(error, t("createError")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <MailQuestion className="h-5 w-5" />
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <MessagesSquare className="h-4 w-4" />
          <div className="text-sm font-semibold">{t("newThreadTitle")}</div>
        </div>

        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t("categoryLabel")}</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
              className="select-base w-full rounded-xl px-3 py-2 text-sm"
            >
              {categories.map((value) => (
                <option key={value} value={value}>
                  {t(`category.${value}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">{t("subjectLabel")}</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("subjectPlaceholder")}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none"
              maxLength={120}
            />
          </label>
        </div>

        <label className="mt-3 block space-y-1 text-sm">
          <span className="font-medium">{t("bodyLabel")}</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("bodyPlaceholder")}
            className="min-h-36 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none"
            maxLength={4000}
          />
        </label>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-muted-foreground">{t("createNotice")}</p>
          <button
            type="button"
            onClick={submitThread}
            disabled={submitting || !body.trim()}
            className={cn(
              "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition-all",
              "bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40",
            )}
          >
            {submitting ? t("submitting") : t("submitAction")}
          </button>
        </div>

        {status ? (
          <p className="mt-3 text-xs font-medium text-blue-600">{status}</p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold">{t("myThreadsTitle")}</div>
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
                </div>
                <div className="text-lg font-semibold">
                  {detail.subject || t("untitled")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("updatedAt", {
                    date: formatDate(detail.updatedAt, locale),
                  })}
                </div>
              </header>

              <div className="space-y-3">
                {detail.messages.map((message) => {
                  const mine = message.authorRole === "USER";
                  return (
                    <article
                      key={message.id}
                      className={cn(
                        "rounded-2xl border px-4 py-3",
                        mine
                          ? "border-indigo-100 bg-indigo-50/60 dark:bg-indigo-950/20"
                          : "border-border bg-muted/30",
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold">
                          {mine ? t("messageRoleUser") : t("messageRoleAdmin")}
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
