"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import DiscussionList from "@/components/DiscussionList";
import { api } from "@/lib/api";
import type { DiscussionListItem } from "@/lib/types";
import styles from "./PublicDiscussionsClient.module.css";

export default function PublicDiscussionsClient({
  initialItems,
  initialFailed,
  children,
}: {
  initialItems: DiscussionListItem[];
  initialFailed: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("Public");
  const params = useParams<{ id?: string }>();
  const selectedId = params?.id;
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
    <div className={styles.container}>
      <p className="text-sm text-muted-foreground">
        {failed ? t("loadErrorStable") : t("description")}
      </p>
      <div
        className={styles.workspace}
        data-has-selection={selectedId ? "true" : "false"}
        data-testid="together-workspace"
      >
        <section
          className={styles.listPane}
          aria-label={t("listLabel")}
          data-testid="together-list-pane"
        >
          <div className={styles.filters}>
            <label className="sr-only" htmlFor="public-title-search">
              {t("searchPlaceholder")}
            </label>
            <input
              id="public-title-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-12 min-w-0 w-full rounded-lg border border-border bg-card px-4 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
              className="h-12 min-w-0 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <option value="latest">{t("sortLatest")}</option>
              <option value="comments">{t("sortComments")}</option>
            </select>
          </div>

          <DiscussionList
            items={items}
            emptyText={t("empty")}
            linkMode="discussion"
            selectedId={selectedId}
            gridClassName={styles.navigationGrid}
          />
        </section>
        <section
          className={styles.detailPane}
          aria-label={t("detailLabel")}
          data-testid="together-detail-pane"
        >
          {selectedId ? (
            children
          ) : (
            <div className={styles.emptySelection}>
              <h2 className="text-xl font-semibold">{t("selectTitle")}</h2>
              <p className="mt-2 text-base leading-7 text-muted-foreground">
                {t("selectDescription")}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
