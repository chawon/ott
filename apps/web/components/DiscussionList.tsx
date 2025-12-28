"use client";

import Link from "next/link";
import { DiscussionListItem } from "@/lib/types";

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export default function DiscussionList({
  items,
  emptyText = "아직 같이 기록이 없어요.",
  linkMode = "title",
}: {
  items: DiscussionListItem[];
  emptyText?: string;
  linkMode?: "title" | "discussion";
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-600 shadow-sm">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        {items.map((d) => (
          <Link
            key={d.id}
            href={linkMode === "discussion" ? `/public/${d.id}` : `/title/${d.titleId}`}
            className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-neutral-50"
          >
            <div className="h-12 w-9 overflow-hidden rounded-md bg-neutral-100">
              {d.posterUrl ? (
                <img
                  src={d.posterUrl}
                  alt={d.titleName}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-neutral-900">
                {d.titleName}
              </div>
              <div className="mt-0.5 text-xs text-neutral-500">
                {d.titleType === "movie" ? "Movie" : "Series"}
                {d.titleYear ? ` · ${d.titleYear}` : ""}
              </div>
            </div>
            <div className="text-right text-xs text-neutral-500">
              <div>{formatShortDate(d.createdAt)}</div>
              <div>{d.commentCount} comments</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
