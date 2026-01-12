"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import DiscussionList from "@/components/DiscussionList";
import { api } from "@/lib/api";
import { DiscussionListItem } from "@/lib/types";

export default function PublicDiscussionsPage() {
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

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xl font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          모두 함께 기록
        </div>
        <div className="text-sm text-neutral-600">
          {loading ? "불러오는 중…" : err ? err : "공개된 기록을 한눈에 함께"}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목 검색"
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none md:w-72"
        />
        <div className="flex items-center gap-2">
          <div className="text-xs text-neutral-500">정렬</div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "latest" | "comments")}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs"
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
