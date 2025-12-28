"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Comment, CreateCommentRequest, Discussion, MentionRef, TitleSearchItem } from "@/lib/types";
import { formatNoteInline } from "@/lib/utils";
import TitleSearchBox from "@/components/TitleSearchBox";

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CommentsPanel({
  titleId,
  userId,
}: {
  titleId: string;
  userId?: string | null;
}) {
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<MentionRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sort, setSort] = useState<"oldest" | "latest">("oldest");

  const canPost = useMemo(() => !!body.trim() && !posting, [body, posting]);
  const sortedComments = useMemo(() => {
    const next = [...comments];
    if (sort === "latest") next.reverse();
    return next;
  }, [comments, sort]);

  async function loadDiscussion() {
    setLoading(true);
    setErr(null);
    try {
      const d = await api<Discussion | null>(`/discussions?titleId=${encodeURIComponent(titleId)}`);
      setDiscussion(d);
      if (d) {
        const c = await api<Comment[]>(`/discussions/${d.id}/comments?limit=200`);
        setComments(c);
      } else {
        setComments([]);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load discussion");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!titleId) return;
    loadDiscussion();
  }, [titleId]);

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
    try {
      const d = await ensureDiscussion();
      const req: CreateCommentRequest = {
        body: body.trim(),
        userId: userId ?? null,
        mentions,
      };
      const created = await api<Comment>(`/discussions/${d.id}/comments`, {
        method: "POST",
        body: JSON.stringify(req),
      });
      setComments((prev) => [...prev, created]);
      setBody("");
      setMentions([]);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  function addMention(item: TitleSearchItem) {
    const exists = mentions.some((m) => m.providerId === item.providerId && m.provider === item.provider);
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
    setMentions((prev) => prev.filter((m) => !(m.provider === provider && m.providerId === providerId)));
  }

  function renderBody(text: string) {
    const parts = text.split(/(@\{[^}]+\})/g);
    return parts.map((p, idx) => {
      if (p.startsWith("@{") && p.endsWith("}")) {
        const name = p.slice(2, -1);
        return (
          <span key={idx} className="rounded-md bg-indigo-50 px-1 text-indigo-700">
            @{name}
          </span>
        );
      }
      if (p.startsWith("@")) {
        return (
          <span key={idx} className="rounded-md bg-indigo-50 px-1 text-indigo-700">
            {p}
          </span>
        );
      }
      return <span key={idx}>{p}</span>;
    });
  }

  if (loading && !discussion && comments.length === 0) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-neutral-600">불러오는 중…</div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
      <div>
        <div className="text-base font-semibold">같이 기록</div>
        <div className="text-sm text-neutral-600">
          {discussion ? "노트를 남기면 같이 기록으로 쌓여요." : "아직 같이 기록이 없어요. 댓글을 남기면 생성돼요."}
        </div>
      </div>

      {err ? (
        <div className="text-sm text-red-600">{err}</div>
      ) : null}

      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
          placeholder="이 작품에 대한 한 줄을 남겨줘"
        />
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 space-y-2">
          <div className="text-xs text-neutral-600">작품 멘션</div>
          <TitleSearchBox
            onSelect={addMention}
            placeholder="@로 추가할 작품을 검색"
            showRecentDiscussions={false}
          />
          {mentions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {mentions.map((m) => (
                <span
                  key={`${m.provider}:${m.providerId}`}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs"
                >
                  @{m.name}
                  <button
                    type="button"
                    onClick={() => removeMention(m.provider, m.providerId)}
                    className="text-neutral-400 hover:text-neutral-700"
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
          className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {posting ? "Posting…" : "댓글 남기기"}
        </button>
      </div>

      {comments.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
          아직 댓글이 없어요.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{comments.length} comments</span>
            <div className="flex items-center gap-2">
              <span>정렬</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as "oldest" | "latest")}
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs"
              >
                <option value="oldest">오래된 순</option>
                <option value="latest">최신 순</option>
              </select>
            </div>
          </div>
          {sortedComments.map((c) => {
            const isMine = !!userId && c.userId && c.userId === userId;
            return (
              <div
                key={c.id}
                className={[
                  "rounded-xl border p-4",
                  isMine ? "border-emerald-200 bg-emerald-50/50" : "border-neutral-200"
                ].join(" ")}
              >
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span className="font-semibold text-neutral-700">
                    {c.authorName}
                    {isMine ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">내 댓글</span> : null}
                  </span>
                  <span>{formatTime(c.createdAt)}</span>
                </div>
                <div className="mt-2 text-sm text-neutral-800">
                  {renderBody(formatNoteInline(c.body))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
