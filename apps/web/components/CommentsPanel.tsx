"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import TitleSearchBox from "@/components/TitleSearchBox";
import { api } from "@/lib/api";
import { ensureAuth } from "@/lib/auth";
import { getUserId } from "@/lib/localStore";
import type {
  Comment,
  CreateCommentRequest,
  Discussion,
  MentionRef,
  Title,
  TitleSearchItem,
} from "@/lib/types";
import { cn, formatNoteInline } from "@/lib/utils";

function formatTime(iso: string, locale: string) {
  const d = new Date(iso);
  return d.toLocaleString(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function CommentsPanel({
  titleId,
  userId,
  titleType,
}: {
  titleId: string;
  userId?: string | null;
  titleType?: Title["type"];
}) {
  const tComments = useTranslations("CommentsPanel");
  const locale = useLocale();
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<MentionRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sort, setSort] = useState<"oldest" | "latest">("oldest");
  const [visibleCount, setVisibleCount] = useState(5);
  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(
    userId ?? getUserId(),
  );
  const commentBodyId = useId();

  const canPost = useMemo(() => !!body.trim() && !posting, [body, posting]);
  const sortedComments = useMemo(() => {
    const next = [...comments];
    if (sort === "latest") next.reverse();
    return next;
  }, [comments, sort]);
  const visibleComments = useMemo(
    () => sortedComments.slice(0, visibleCount),
    [sortedComments, visibleCount],
  );

  const loadDiscussion = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setVisibleCount(5);
    try {
      const d = await api<Discussion | null>(
        `/discussions?titleId=${encodeURIComponent(titleId)}`,
      );
      setDiscussion(d);
      if (d) {
        const c = await api<Comment[]>(
          `/discussions/${d.id}/comments?limit=200`,
        );
        setComments(c);
      } else {
        setComments([]);
      }
    } catch (error: unknown) {
      setErr(errorMessage(error, tComments("loadError")));
    } finally {
      setLoading(false);
    }
  }, [titleId, tComments]);

  useEffect(() => {
    if (!titleId) return;
    loadDiscussion();
  }, [titleId, loadDiscussion]);

  useEffect(() => {
    setEffectiveUserId(userId ?? getUserId());
  }, [userId]);

  async function ensureDiscussion() {
    if (discussion) return discussion;
    const created = await api<Discussion>("/discussions", {
      method: "POST",
      body: JSON.stringify({ titleId }),
    });
    setDiscussion(created);
    return created;
  }

  async function postComment() {
    if (!canPost) return;
    setPosting(true);
    setErr(null);
    try {
      const auth = await ensureAuth();
      const currentUserId = auth?.userId ?? getUserId();
      if (!currentUserId) {
        throw new Error(tComments("loginRequired"));
      }
      setEffectiveUserId(currentUserId);

      const d = await ensureDiscussion();
      const req: CreateCommentRequest = {
        body: body.trim(),
        mentions,
      };
      const created = await api<Comment>(`/discussions/${d.id}/comments`, {
        method: "POST",
        body: JSON.stringify(req),
      });
      setComments((prev) => [...prev, created]);
      setBody("");
      setMentions([]);
    } catch (error: unknown) {
      setErr(errorMessage(error, tComments("postError")));
    } finally {
      setPosting(false);
    }
  }

  function addMention(item: TitleSearchItem) {
    const exists = mentions.some(
      (m) => m.providerId === item.providerId && m.provider === item.provider,
    );
    if (exists) return;
    setMentions((prev) => [
      ...prev,
      {
        provider: item.provider,
        providerId: item.providerId,
        titleType: item.type,
        name: item.name,
      },
    ]);
    const token = `@{${item.name}}`;
    setBody((prev) => (prev.trim() ? `${prev} ${token}` : token));
  }

  function removeMention(provider: string, providerId: string) {
    setMentions((prev) =>
      prev.filter(
        (m) => !(m.provider === provider && m.providerId === providerId),
      ),
    );
  }

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

  if (loading && !discussion && comments.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="text-sm text-neutral-600">{tComments("loading")}</div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <div className="text-base font-semibold">
          {tComments("sectionTitleModern")}
        </div>
        <div className="text-sm text-muted-foreground">
          {discussion ? tComments("descModern") : tComments("emptyModern")}
        </div>
      </div>

      {err ? <div className="text-sm text-red-600 font-bold">{err}</div> : null}

      {/* 댓글 목록 영역 */}
      <div className="min-h-[200px] space-y-4 rounded-xl border border-border bg-muted/60 p-4">
        {comments.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {tComments("commentsEmptyModern")}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 border-b border-border pb-2">
              <span>
                {tComments("commentCountModern", { count: comments.length })}
              </span>
              <div className="flex items-center gap-2">
                <span>{tComments("sortLabel")}</span>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as "oldest" | "latest");
                    setVisibleCount(5);
                  }}
                  className="text-xs select-base rounded-lg px-2 py-1 text-foreground"
                >
                  <option value="oldest">{tComments("sortOldest")}</option>
                  <option value="latest">{tComments("sortLatest")}</option>
                </select>
              </div>
            </div>
            {visibleComments.map((c) => {
              const isMine =
                !!effectiveUserId && c.userId && c.userId === effectiveUserId;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "p-4 transition-all",
                    isMine
                      ? "rounded-xl border border-emerald-300/60 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/40"
                      : "rounded-xl border border-border bg-card shadow-sm",
                  )}
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span className="font-semibold text-foreground">
                      {c.authorName}
                      {isMine ? (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100">
                          {tComments("myCommentLabel")}
                        </span>
                      ) : null}
                    </span>
                    <span>{formatTime(c.createdAt, locale)}</span>
                  </div>
                  <div className="text-sm leading-relaxed text-foreground">
                    {renderBody(formatNoteInline(c.body))}
                  </div>
                </div>
              );
            })}
            {sortedComments.length > visibleCount ? (
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 5)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                {tComments("viewMore")}
              </button>
            ) : null}
          </>
        )}
      </div>

      {/* 댓글 입력 영역 (하단 이동) */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="space-y-2">
          <label
            htmlFor={commentBodyId}
            className="text-sm font-bold block text-muted-foreground"
          >
            {tComments("inputTitleModern")}
          </label>
          <textarea
            id={commentBodyId}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full text-sm resize-none transition-all rounded-xl border border-border bg-card px-3 py-2 text-foreground focus:ring-2 focus:ring-ring/40 focus:border-border"
            placeholder={tComments("placeholderModern")}
          />
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-muted/60 p-3">
          <div className="text-sm text-muted-foreground">
            {tComments("mentionTitleModern")}
          </div>
          <TitleSearchBox
            onSelect={addMention}
            placeholder={
              titleType === "book"
                ? tComments("mentionPlaceholderBook")
                : tComments("mentionPlaceholderVideo")
            }
            showRecentDiscussions={false}
            contentType={titleType === "book" ? "book" : "video"}
          />
          {mentions.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {mentions.map((m) => (
                <span
                  key={`${m.provider}:${m.providerId}`}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground"
                >
                  @{m.name}
                  <button
                    type="button"
                    onClick={() => removeMention(m.provider, m.providerId)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          disabled={!canPost}
          onClick={postComment}
          className="w-full py-3 text-sm font-semibold transition-all rounded-2xl bg-neutral-900 text-white hover:bg-neutral-800 active:scale-[0.98] disabled:opacity-40"
        >
          {posting ? tComments("posting") : tComments("submitActionModern")}
        </button>
      </div>
    </section>
  );
}
