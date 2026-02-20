"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { ensureAuth } from "@/lib/auth";
import { getUserId } from "@/lib/localStore";
import { Comment, CreateCommentRequest, Discussion, MentionRef, Title, TitleSearchItem } from "@/lib/types";
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
  titleType,
}: {
  titleId: string;
  userId?: string | null;
  titleType?: Title["type"];
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
  const [visibleCount, setVisibleCount] = useState(5);
  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(userId ?? getUserId());

  const canPost = useMemo(() => !!body.trim() && !posting, [body, posting]);
  const sortedComments = useMemo(() => {
    const next = [...comments];
    if (sort === "latest") next.reverse();
    return next;
  }, [comments, sort]);
  const visibleComments = useMemo(
    () => sortedComments.slice(0, visibleCount),
    [sortedComments, visibleCount]
  );

  useEffect(() => {
    setVisibleCount(5);
  }, [sort, titleId]);

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
      setErr(e?.message ?? "함께 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!titleId) return;
    loadDiscussion();
  }, [titleId]);

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
        throw new Error("댓글을 남기려면 먼저 계정 연결이 필요해요.");
      }
      setEffectiveUserId(currentUserId);

      const d = await ensureDiscussion();
      const req: CreateCommentRequest = {
        body: body.trim(),
        userId: currentUserId,
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
      setErr(e?.message ?? "댓글을 남기지 못했어요. 다시 시도해 주세요.");
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
            isRetro
              ? "bg-blue-100 text-blue-800 px-1 border border-blue-800 mx-0.5"
              : "rounded-md bg-accent px-1 text-accent-foreground"
          )}>
            @{name}
          </span>
        );
      }
      if (p.startsWith("@")) {
        return (
          <span key={idx} className={cn(
            isRetro
              ? "bg-blue-100 text-blue-800 px-1 border border-blue-800 mx-0.5"
              : "rounded-md bg-accent px-1 text-accent-foreground"
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
        isRetro ? "nes-container border-4 border-black p-6" : "rounded-2xl border border-border bg-card p-6 shadow-sm"
      )}>
        <div className="text-sm text-neutral-600">불러오는 중…</div>
      </section>
    );
  }

  return (
    <section className={cn(
      "space-y-4",
      isRetro ? "nes-container border-4 border-black p-6" : "rounded-2xl border border-border bg-card p-6 shadow-sm"
    )}>
      <div>
        <div className={cn("text-base font-semibold", isRetro && "text-lg")}>
          {isRetro ? "수다판" : "함께 기록"}
        </div>
        <div className="text-sm text-muted-foreground">
          {discussion ? (isRetro ? "이 작품 수다판에 한 줄 남겨보세요." : "노트를 남기면 같이 기록으로 쌓여요.") : (isRetro ? "아직 수다판 기록이 없어요. 첫 기록자가 되어보세요!" : "아직 같이 기록이 없어요. 댓글을 남기면 생성돼요.")}
        </div>
      </div>

      {err ? (
        <div className="text-sm text-red-600 font-bold">{err}</div>
      ) : null}

      {/* 댓글 목록 영역 */}
      <div className={cn(
        "min-h-[200px] space-y-4",
        isRetro ? "border-4 border-black bg-[#f0f0f0] p-4 shadow-[inset_4px_4px_0px_0px_#e0e0e0]" : "rounded-xl border border-border bg-muted/60 p-4"
      )}>
        {comments.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {isRetro ? "아직 조용해요" : "아직 댓글이 없어요."}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 border-b border-border pb-2">
              <span className={cn(isRetro && "font-bold")}>{comments.length} {isRetro ? "개의 수다" : "개의 이야기들"}</span>
              <div className="flex items-center gap-2">
                <span>정렬</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "oldest" | "latest")}
                  className={cn(
                    "text-xs",
                    isRetro ? "bg-white border-2 border-black" : "select-base rounded-lg px-2 py-1 text-foreground"
                  )}
                >
                  <option value="oldest">오래된 순</option>
                  <option value="latest">최신 순</option>
                </select>
              </div>
            </div>
            {visibleComments.map((c) => {
              const isMine = !!effectiveUserId && c.userId && c.userId === effectiveUserId;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "p-4 transition-all",
                    isRetro 
                      ? (isMine ? "border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" : "border-2 border-dashed border-neutral-400 bg-white")
                      : (isMine ? "rounded-xl border border-emerald-300/60 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/40" : "rounded-xl border border-border bg-card shadow-sm")
                  )}
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span className={cn("font-semibold text-foreground", isRetro && "text-black")}>
                      {c.authorName}
                      {isMine ? (
                        isRetro 
                          ? <span className="ml-2 bg-black text-white px-1 text-[10px]">나</span>
                          : <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100">내 댓글</span>
                      ) : null}
                    </span>
                    <span className={cn(isRetro && "font-bold text-black")}>{formatTime(c.createdAt)}</span>
                  </div>
                  <div className={cn("text-sm leading-relaxed", isRetro ? "text-black" : "text-foreground")}>
                    {renderBody(formatNoteInline(c.body))}
                  </div>
                </div>
              );
            })}
            {sortedComments.length > visibleCount ? (
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 5)}
                className={cn(
                  "w-full rounded-xl border border-border px-3 py-2 text-xs font-semibold",
                  isRetro ? "border-2 border-black bg-white text-black" : "bg-card text-foreground hover:bg-muted"
                )}
              >
                {isRetro ? "더 보기" : "더 보기"}
              </button>
            ) : null}
          </>
        )}
      </div>

      {/* 댓글 입력 영역 (하단 이동) */}
      <div className={cn(
        "space-y-3 pt-4",
        isRetro ? "border-t-4 border-black" : "border-t border-border"
      )}>
        <div className="space-y-2">
          <label className={cn("text-sm font-bold block", isRetro ? "text-black" : "text-muted-foreground")}>
            {isRetro ? "하하호호" : "의견 남기기"}
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className={cn(
              "w-full text-sm resize-none transition-all",
              isRetro 
                ? "border-4 border-black bg-white px-3 py-2 font-bold shadow-[inset_4px_4px_0px_0px_#e0e0e0] focus:ring-0" 
                : "rounded-xl border border-border bg-card px-3 py-2 text-foreground focus:ring-2 focus:ring-ring/40 focus:border-border"
            )}
            placeholder={isRetro ? "넌 이 비디오 어땠니?..." : "이 작품에 대한 한 줄을 남겨주세요."}
          />
        </div>

        <div className={cn(
          "space-y-2",
          isRetro ? "border-2 border-dashed border-neutral-400 p-2 bg-[#f0f0f0]" : "rounded-xl border border-border bg-muted/60 p-3"
        )}>
          <div className={cn("text-sm", isRetro ? "font-bold text-black" : "text-muted-foreground")}>
            {isRetro ? "다른 비디오" : "작품 멘션"}
          </div>
          <TitleSearchBox
            onSelect={addMention}
            placeholder={
              isRetro
                ? "@ TITLE SEARCH"
                : titleType === "book"
                ? "@로 추가할 책을 검색"
                : "@로 추가할 작품을 검색"
            }
            showRecentDiscussions={false}
            contentType={titleType === "book" ? "book" : "video"}
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
                      : "rounded-full border border-border bg-card text-foreground"
                  )}
                >
                  @{m.name}
                  <button
                    type="button"
                    onClick={() => removeMention(m.provider, m.providerId)}
                    className={cn(isRetro ? "text-black hover:text-red-600 font-black" : "text-muted-foreground hover:text-foreground")}
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
          {posting ? "등록 중..." : (isRetro ? "나의 수다 올리기" : "댓글 등록")}
        </button>
      </div>
    </section>
  );
}
