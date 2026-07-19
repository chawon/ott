"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import DiscussionList from "@/components/DiscussionList";
import { api } from "@/lib/api";
import type { DiscussionListItem } from "@/lib/types";

export default function PublicDiscussionsClient({
  initialItems,
  initialFailed,
}: {
  initialItems: DiscussionListItem[];
  initialFailed: boolean;
}) {
  const t = useTranslations("Public");
  const [sourceItems, setSourceItems] = useState(initialItems);
  const [failed, setFailed] = useState(initialFailed);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"latest" | "comments">("latest");

  useEffect(() => {
    let cancelled = false;

    void api<DiscussionListItem[]>("/discussions/all?limit=100")
      .then((freshItems) => {
        if (cancelled) return;
        setSourceItems(freshItems);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled && initialItems.length === 0) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [initialItems]);

  const items = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = normalizedQuery
      ? sourceItems.filter((item) =>
          item.titleName.toLocaleLowerCase().includes(normalizedQuery),
        )
      : sourceItems;

    return [...filtered].sort((a, b) => {
      if (sort === "comments") return b.commentCount - a.commentCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [sourceItems, query, sort]);

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {failed ? t("loadErrorStable") : t("description")}
      </p>
      <div className="flex items-center gap-3 overflow-x-auto rounded-lg border border-border bg-card p-3 no-scrollbar">
        <label className="sr-only" htmlFor="public-title-search">
          {t("searchPlaceholder")}
        </label>
        <input
          id="public-title-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-12 w-full min-w-[120px] rounded-lg border border-border bg-card px-4 text-base outline-none focus:border-[#FF9933] sm:w-72"
        />
        <label className="sr-only" htmlFor="public-sort">
          {t("sortLabel")}
        </label>
        <select
          id="public-sort"
          value={sort}
          onChange={(event) =>
            setSort(event.target.value as "latest" | "comments")
          }
          className="h-12 shrink-0 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-[#FF9933]"
        >
          <option value="latest">{t("sortLatest")}</option>
          <option value="comments">{t("sortComments")}</option>
        </select>
      </div>

      <DiscussionList
        items={items}
        emptyText={t("empty")}
        linkMode="discussion"
      />
    </>
  );
}
