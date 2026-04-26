"use client";

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import DiscussionList from "@/components/DiscussionList";
import { api } from "@/lib/api";
import type { DiscussionListItem } from "@/lib/types";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function PublicDiscussionsPage() {
  const tPublic = useTranslations("Public");
  const [items, setItems] = useState<DiscussionListItem[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"latest" | "comments">("latest");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filtered = items.filter((i) =>
    i.titleName.toLowerCase().includes(query.trim().toLowerCase()),
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
        const res = await api<DiscussionListItem[]>(
          "/discussions/all?limit=100",
        );
        setItems(res);
      } catch (error) {
        setErr(getErrorMessage(error, tPublic("loadError")));
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [tPublic]);

  const headerTitle = tPublic("title");
  const headerSubtitle = loading
    ? tPublic("loading")
    : err
      ? err
      : tPublic("description");

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xl font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          {headerTitle}
        </div>
        <div className="text-sm text-muted-foreground">{headerSubtitle}</div>
      </div>

      <div className="flex flex-row items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm overflow-x-auto no-scrollbar">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tPublic("searchPlaceholder")}
          className="flex h-10 w-full min-w-[120px] shrink items-center rounded-xl border border-border bg-card px-3 text-sm outline-none sm:w-72"
        />
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "latest" | "comments")}
            className="flex h-10 items-center select-base rounded-xl px-3 py-0 text-sm outline-none transition-all"
          >
            <option value="latest">{tPublic("sortLatest")}</option>
            <option value="comments">{tPublic("sortComments")}</option>
          </select>
        </div>
      </div>

      <DiscussionList
        items={sorted}
        emptyText={tPublic("empty")}
        linkMode="discussion"
      />
    </div>
  );
}
