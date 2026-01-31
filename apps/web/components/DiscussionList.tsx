"use client";

import Link from "next/link";
import { DiscussionListItem } from "@/lib/types";
import { useRetro } from "@/context/RetroContext";
import { cn, tmdbResize } from "@/lib/utils";

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
  const { isRetro } = useRetro();

  if (items.length === 0) {
    return (
      <div className={cn(
        isRetro 
          ? "border-4 border-black bg-white p-5 text-sm font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" 
          : "rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm"
      )}>
        {emptyText}
      </div>
    );
  }

  if (isRetro) {
    return (
      <div className="border-4 border-black bg-white p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="space-y-1">
          {items.map((d) => (
            <Link
              key={d.id}
              href={linkMode === "discussion" ? `/public/${d.id}` : `/title/${d.titleId}`}
              className="flex items-center gap-3 border-b-2 border-dashed border-neutral-300 px-2 py-3 transition-none hover:bg-yellow-100 last:border-b-0"
            >
              <div className="h-20 w-14 shrink-0 border-2 border-black bg-neutral-200">
                {d.posterUrl ? (
                  <img
                    src={tmdbResize(d.posterUrl, "w185") ?? d.posterUrl}
                    alt={d.titleName}
                    className="h-full w-full object-cover pixelated"
                    style={{ imageRendering: "pixelated" }}
                    loading="lazy"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-bold uppercase text-black">
                  {d.titleName}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs font-bold text-neutral-500 uppercase">
                  <span className="bg-black text-white px-1">
                    {d.titleType === "movie" ? "영화" : d.titleType === "series" ? "연속극" : "책"}
                  </span>
                  {d.titleYear ? <span>{d.titleYear}</span> : ""}
                </div>
              </div>
              <div className="shrink-0 text-right text-[10px] font-bold uppercase text-blue-600">
                <div className="bg-blue-600 text-white px-1 mb-1 inline-block">{formatShortDate(d.createdAt)}</div>
                <div className="text-black">💬 {d.commentCount}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm text-card-foreground">
      <div className="space-y-3">
        {items.map((d) => (
          <Link
            key={d.id}
            href={linkMode === "discussion" ? `/public/${d.id}` : `/title/${d.titleId}`}
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
                {d.titleType === "movie" ? "Movie" : d.titleType === "series" ? "Series" : "Book"}
                {d.titleYear ? ` · ${d.titleYear}` : ""}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>{formatShortDate(d.createdAt)}</div>
              <div>{d.commentCount}개의 이야기들</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
