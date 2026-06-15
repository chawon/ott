"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import DiscussionReactionChips from "@/components/DiscussionReactionChips";
import type { DiscussionListItem, TitleSearchItem } from "@/lib/types";
import { cn, tmdbResize } from "@/lib/utils";

function formatShortDate(iso: string, locale: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function DiscussionList({
  items,
  trendingItems = [],
  emptyText,
  linkMode = "title",
  showReactions,
  onTrendingSelect,
}: {
  items: DiscussionListItem[];
  trendingItems?: TitleSearchItem[];
  emptyText?: string;
  linkMode?: "title" | "discussion";
  showReactions?: boolean;
  onTrendingSelect?: (item: TitleSearchItem) => void;
}) {
  const tList = useTranslations("DiscussionList");
  const locale = useLocale();
  const shouldShowReactions = showReactions ?? linkMode === "discussion";

  if (items.length === 0 && trendingItems.length === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border bg-card/85 p-5 text-sm text-muted-foreground shadow-sm",
        )}
      >
        {emptyText || tList("defaultEmpty")}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/85 p-4 text-card-foreground shadow-sm">
      <div className="space-y-3">
        {items.map((d) => (
          <article
            key={d.id}
            className="rounded-xl px-2 py-2 transition hover:bg-ott-paper-strong/80"
          >
            <Link
              href={
                linkMode === "discussion"
                  ? `/public/${d.id}`
                  : `/title/${d.titleId}`
              }
              className="flex items-center gap-4"
            >
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                {d.posterUrl ? (
                  <img
                    src={tmdbResize(d.posterUrl, "w185") ?? d.posterUrl}
                    alt={d.titleName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">
                  {d.titleName}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {d.titleType === "movie"
                    ? tList("typeMovie")
                    : d.titleType === "series"
                      ? tList("typeSeriesModern")
                      : tList("typeBook")}
                  {d.titleYear ? ` · ${d.titleYear}` : ""}
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{formatShortDate(d.createdAt, locale)}</div>
                <div>
                  {tList("commentCountModern", { count: d.commentCount })}
                </div>
              </div>
            </Link>
            {shouldShowReactions ? (
              <div className="mt-3 pl-16">
                <DiscussionReactionChips
                  discussionId={d.id}
                  title={{
                    id: d.titleId,
                    name: d.titleName,
                    type: d.titleType,
                    year: d.titleYear,
                    posterUrl: d.posterUrl,
                  }}
                  summary={d.reactionSummary}
                  compact
                />
              </div>
            ) : null}
          </article>
        ))}
        {trendingItems.map((item) => (
          <article
            key={`${item.provider}:${item.providerId}`}
            className="rounded-xl px-2 py-2 transition hover:bg-ott-paper-strong/80"
          >
            <button
              type="button"
              onClick={() => onTrendingSelect?.(item)}
              className="flex w-full items-center gap-4 text-left"
            >
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                {item.posterUrl ? (
                  <img
                    src={tmdbResize(item.posterUrl, "w185") ?? item.posterUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">
                  {item.name}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {item.type === "movie"
                    ? tList("typeMovie")
                    : item.type === "series"
                      ? tList("typeSeriesModern")
                      : tList("typeBook")}
                  {item.year ? ` · ${item.year}` : ""}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="inline-flex rounded-full border border-ott-warm bg-ott-warm/60 px-2 py-1 text-[10px] font-semibold text-ott-warm-foreground">
                  {tList("trendingBadge")}
                </div>
                <div className="mt-1 text-xs font-medium text-muted-foreground">
                  {tList("trendingAction")}
                </div>
              </div>
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
