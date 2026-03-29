"use client";

import Link from "next/link";
import { DiscussionListItem } from "@/lib/types";
import { useLocale, useTranslations } from "next-intl";
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
  emptyText,
  linkMode = "title",
}: {
  items: DiscussionListItem[];
  emptyText?: string;
  linkMode?: "title" | "discussion";
}) {
  const tList = useTranslations("DiscussionList");
  const locale = useLocale();

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm",
        )}
      >
        {emptyText || tList("defaultEmpty")}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm text-card-foreground">
      <div className="space-y-3">
        {items.map((d) => (
          <Link
            key={d.id}
            href={
              linkMode === "discussion"
                ? `/public/${d.id}`
                : `/title/${d.titleId}`
            }
            className="flex items-center gap-4 rounded-xl px-2 py-2 transition hover:bg-muted"
          >
            <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-muted border border-border">
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
        ))}
      </div>
    </div>
  );
}
