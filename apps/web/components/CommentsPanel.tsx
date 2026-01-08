"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Comment, CreateCommentRequest, Discussion, MentionRef, TitleSearchItem } from "@/lib/types";
import { formatNoteInline } from "@/lib/utils";
import TitleSearchBox from "@/components/TitleSearchBox";
import { useRetro } from "@/context/RetroContext";
import { cn } from "@/lib/utils";

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
  const { isRetro } = useRetro();
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
          <span key={idx} className={cn(
            isRetro ? "bg-blue-100 text-blue-800 px-1 border border-blue-800 mx-0.5" : "rounded-md bg-indigo-50 px-1 text-indigo-700"
          )}>
            @{name}
          </span>
        );
      }
      if (p.startsWith("@")) {
        return (
          <span key={idx} className={cn(
            isRetro ? "bg-blue-100 text-blue-800 px-1 border border-blue-800 mx-0.5" : "rounded-md bg-indigo-50 px-1 text-indigo-700"
          )}>
            {p}
          </span>
        );
      }
      return <span key={idx}>{p}</span>;
    });
  }

  if (loading && !discussion && comments.length === 0) {
    return (
      <section className={cn(
        isRetro ? "nes-container border-4 border-black p-6" : "rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      )}>
        <div className="text-sm text-neutral-600">로딩 중...</div>
      </section>
    );
  }

  return (
    <section className={cn(
      "space-y-4",
      isRetro ? "nes-container border-4 border-black p-6" : "rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
    )}>
      <div>
        <div className={cn("text-base font-semibold", isRetro && "uppercase text-lg")}>
          {isRetro ? "함께 기록하기" : "함께 기록"}
        </div>
        <div className="text-sm text-neutral-600">
          {discussion ? (isRetro ? "이 작품에 대한 동료들의 기록입니다." : "노트를 남기면 같이 기록으로 쌓여요.") : (isRetro ? "아직 기록이 없습니다. 첫 번째 기록자가 되어보세요!" : "아직 같이 기록이 없어요. 댓글을 남기면 생성돼요.")}
        </div>
      </div>

      {err ? (
        <div className="text-sm text-red-600 font-bold">{err}</div>
      ) : null}

      {/* 댓글 목록 영역 */}
      <div className={cn(
        "min-h-[200px] max-h-[500px] overflow-y-auto pr-2 space-y-4",
        isRetro ? "border-4 border-black bg-[#f0f0f0] p-4 shadow-[inset_4px_4px_0px_0px_#e0e0e0]" : "rounded-xl border border-neutral-100 bg-neutral-50/50 p-4"
      )}>
        {comments.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-neutral-500">
            {isRetro ? "EMPTY LOG" : "아직 댓글이 없어요."}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-4 sticky top-0 bg-inherit z-10 py-2 border-b border-neutral-200">
              <span className={cn(isRetro && "font-bold uppercase")}>{comments.length} {isRetro ? "ENTRIES" : "comments"}</span>
              <div className="flex items-center gap-2">
                <span>정렬</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "oldest" | "latest")}
                  className={cn(
                    "text-xs",
                    isRetro ? "bg-white border-2 border-black" : "rounded-lg border border-neutral-200 bg-white px-2 py-1"
                  )}
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
                  className={cn(
                    "p-4 transition-all",
                    isRetro 
                      ? (isMine ? "border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" : "border-2 border-dashed border-neutral-400 bg-white")
                      : (isMine ? "rounded-xl border border-emerald-200 bg-emerald-50/50" : "rounded-xl border border-neutral-200 bg-white shadow-sm")
                  )}
                >
                  <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
                    <span className={cn("font-semibold text-neutral-700", isRetro && "uppercase text-black")}>
                      {c.authorName}
                      {isMine ? (
                        isRetro 
                          ? <span className="ml-2 bg-black text-white px-1 text-[10px]">ME</span>
                          : <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">내 댓글</span>
                      ) : null}
                    </span>
                    <span className={cn(isRetro && "font-bold text-black")}>{formatTime(c.createdAt)}</span>
                  </div>
                  <div className={cn("text-sm leading-relaxed", isRetro ? "text-black" : "text-neutral-800")}>
                    {renderBody(formatNoteInline(c.body))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* 댓글 입력 영역 (하단 이동) */}
      <div className={cn(
        "space-y-3 pt-4",
        isRetro ? "border-t-4 border-black" : "border-t border-neutral-100"
      )}>
        <div className="space-y-2">
          <label className={cn("text-xs font-bold block", isRetro ? "uppercase text-black" : "text-neutral-600")}>
            {isRetro ? "NEW ENTRY" : "의견 남기기"}
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className={cn(
              "w-full text-sm resize-none transition-all",
              isRetro 
                ? "border-4 border-black bg-white px-3 py-2 font-bold shadow-[inset_4px_4px_0px_0px_#e0e0e0] focus:ring-0" 
                : "rounded-xl border border-neutral-200 bg-white px-3 py-2 focus:ring-2 focus:ring-neutral-900/5 focus:border-neutral-300"
            )}
            placeholder={isRetro ? "기록을 입력하세요..." : "이 작품에 대한 한 줄을 남겨주세요."}
          />
        </div>

        <div className={cn(
          "space-y-2",
          isRetro ? "border-2 border-dashed border-neutral-400 p-2 bg-[#f0f0f0]" : "rounded-xl border border-neutral-200 bg-neutral-50 p-3"
        )}>
          <div className={cn("text-xs", isRetro ? "font-bold uppercase text-black" : "text-neutral-600")}>
            {isRetro ? "LINK TITLES" : "작품 멘션"}
          </div>
          <TitleSearchBox
            onSelect={addMention}
            placeholder={isRetro ? "@ TITLE SEARCH" : "@로 추가할 작품을 검색"}
            showRecentDiscussions={false}
          />
          {mentions.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {mentions.map((m) => (
                <span
                  key={`${m.provider}:${m.providerId}`}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-1 text-xs",
                    isRetro 
                      ? "border-2 border-black bg-yellow-300 text-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" 
                      : "rounded-full border border-neutral-200 bg-white"
                  )}
                >
                  @{m.name}
                  <button
                    type="button"
                    onClick={() => removeMention(m.provider, m.providerId)}
                    className={cn(isRetro ? "text-black hover:text-red-600 font-black" : "text-neutral-400 hover:text-neutral-700")}
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
          className={cn(
            "w-full py-3 text-sm font-semibold transition-all",
            isRetro 
              ? "nes-btn is-primary border-4 border-black text-white uppercase disabled:opacity-50 disabled:bg-gray-400 disabled:border-gray-600"
              : "rounded-2xl bg-neutral-900 text-white hover:bg-neutral-800 active:scale-[0.98] disabled:opacity-40"
          )}
        >
          {posting ? (isRetro ? "SAVING..." : "등록 중...") : (isRetro ? "SAVE COMMENT" : "댓글 등록")}
        </button>
      </div>
    </section>
  );
}