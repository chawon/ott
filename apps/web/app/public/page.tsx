"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import DiscussionList from "@/components/DiscussionList";
import { api } from "@/lib/api";
import { DiscussionListItem } from "@/lib/types";
import { useRetro } from "@/context/RetroContext";
import { cn } from "@/lib/utils";

export default function PublicDiscussionsPage() {
  const { isRetro } = useRetro();
  const [items, setItems] = useState<DiscussionListItem[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"latest" | "comments">("latest");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filtered = items.filter((i) =>
    i.titleName.toLowerCase().includes(query.trim().toLowerCase())
  );
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "comments") return b.commentCount - a.commentCount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await api<DiscussionListItem[]>("/discussions/all?limit=100");
        setItems(res);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load discussions");
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const headerTitle = isRetro ? "수다판" : "함께 기록";
  const headerSubtitle = loading 
    ? "불러오는 중…" 
    : err 
      ? err 
      : isRetro 
        ? "요즘 올라온 기록과 댓글 구경하기" 
        : "공개로 남긴 기록을 둘러보고 영감을 얻어요.";

  return (
    <div className="space-y-4">
      <div>
        {isRetro ? (
          <div className="flex items-baseline justify-between border-b-4 border-black pb-2 mb-4">
            <div className="text-xl font-bold uppercase tracking-tighter">{headerTitle}</div>
          </div>
        ) : (
          <div className="text-xl font-semibold flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {headerTitle}
          </div>
        )}
        <div className={cn(
          isRetro ? "text-xs font-bold text-neutral-500 uppercase" : "text-sm text-muted-foreground"
        )}>
          {headerSubtitle}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목 검색"
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none md:w-72"
        />
        <div className="flex items-center gap-2">
          <div className="text-xs text-neutral-500">정렬</div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "latest" | "comments")}
            className="select-base rounded-xl px-3 py-2 text-xs"
          >
            <option value="latest">최신</option>
            <option value="comments">댓글 많은 순</option>
          </select>
        </div>
      </div>

      <DiscussionList
        items={sorted}
        emptyText="함께 기록이 아직 없어요."
        linkMode="discussion"
      />
    </div>
  );
}
