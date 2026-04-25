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

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tPublic("searchPlaceholder")}
          className="min-h-12 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none md:w-72"
        />
        <div className="flex w-full items-center justify-between gap-2 md:w-auto">
          <div className="text-xs text-neutral-500">{tPublic("sortLabel")}</div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "latest" | "comments")}
            className="min-h-12 select-base rounded-xl px-3 text-sm"
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
