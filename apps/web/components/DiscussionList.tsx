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
      <div className="border-4 border-black bg-white p-5 text-sm font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="border-4 border-black bg-white p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="space-y-1">
        {items.map((d) => (
          <Link
            key={d.id}
            href={linkMode === "discussion" ? `/public/${d.id}` : `/title/${d.titleId}`}
            className="flex items-center gap-3 border-b-2 border-dashed border-neutral-300 px-2 py-3 transition-none hover:bg-yellow-100 last:border-b-0"
          >
            <div className="h-14 w-10 shrink-0 border-2 border-black bg-neutral-200">
              {d.posterUrl ? (
                <img
                  src={d.posterUrl}
                  alt={d.titleName}
                  className="h-full w-full object-cover pixelated"
                  style={{ imageRendering: "pixelated" }}
                  loading="lazy"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold uppercase text-black">
                {d.titleName}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-neutral-500 uppercase">
                <span className="bg-black text-white px-1">
                  {d.titleType === "movie" ? "MOVIE" : "SERIES"}
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
