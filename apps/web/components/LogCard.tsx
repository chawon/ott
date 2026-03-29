import Link from "next/link";
import { BookOpen, Film, Tv } from "lucide-react";
import { WatchLog } from "@/lib/types";
import {
  formatNoteInline,
  occasionLabel,
  placeLabel,
  statusLabel,
  tmdbResize,
} from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";

function formatDate(iso: string, locale: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function renderBody(text: string) {
  const parts = text.split(/(@\{[^}]+\})/g);
  return parts.map((p, idx) => {
    if (p.startsWith("@{") && p.endsWith("}")) {
      const name = p.slice(2, -1);
      return (
        <span
          key={idx}
          className="rounded-md bg-accent px-1 text-accent-foreground"
        >
          @{name}
        </span>
      );
    }
    if (p.startsWith("@")) {
      return (
        <span
          key={idx}
          className="rounded-md bg-accent px-1 text-accent-foreground"
        >
          {p}
        </span>
      );
    }
    return <span key={idx}>{p}</span>;
  });
}

function chip(label: string, tone: "place" | "occasion") {
  const toneClass =
    tone === "place"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${toneClass}`}>
      {label}
    </span>
  );
}

function seasonEpisodeLabel(log: WatchLog) {
  if (typeof log.seasonNumber !== "number") return null;
  if (typeof log.episodeNumber === "number") {
    return `S${log.seasonNumber} · E${log.episodeNumber}`;
  }
  return `S${log.seasonNumber}`;
}

export default function LogCard({ log }: { log: WatchLog }) {
  const t = log.title;
  const locale = useLocale();
  const tStatus = useTranslations("Status");
  const tCommon = useTranslations("Common");

  if (log.deletedAt) return null;
  if (!t?.id) return null;
  const seasonLabel = seasonEpisodeLabel(log);
  const isCommentOrigin = log.origin === "COMMENT";
  const isBook = t.type === "book";

  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-all flex gap-5",
        isBook &&
          "bg-emerald-50/30 ring-1 ring-emerald-100/80 dark:bg-emerald-950/25 dark:ring-emerald-900/60",
        isBook &&
          !isCommentOrigin &&
          "border-emerald-200 dark:border-emerald-900/50",
        isCommentOrigin
          ? "border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/30"
          : "hover:border-border/80",
      )}
    >
      <div className="shrink-0">
        <div className="h-32 w-20 overflow-hidden rounded-xl bg-muted shadow-sm border border-border">
          {(log.seasonPosterUrl ?? t.posterUrl) ? (
            <img
              src={
                tmdbResize((log.seasonPosterUrl ?? t.posterUrl) || "", "w185") ??
                log.seasonPosterUrl ??
                t.posterUrl ??
                ""
              }
              alt={t.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground font-medium">
              NO IMAGE
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <Link
              href={`/title/${t.id}`}
              className="text-lg font-bold text-foreground hover:underline decoration-muted-foreground underline-offset-4 truncate block"
            >
              {t.name}
            </Link>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {isBook ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <BookOpen className="h-3 w-3" />
                  BOOK
                </span>
              ) : t.type === "movie" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200/80 bg-indigo-50/70 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200">
                  <Film className="h-3 w-3" />
                  MOVIE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50/70 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                  <Tv className="h-3 w-3" />
                  SERIES
                </span>
              )}
              <span>{statusLabel(log.status, t.type, tStatus)}</span>
              {seasonLabel ? (
                <>
                  <span className="text-muted-foreground/60">·</span>
                  <span>{seasonLabel}</span>
                </>
              ) : null}
              <span className="text-muted-foreground/60">·</span>
              <span>{formatDate(log.watchedAt ?? log.createdAt, locale)}</span>
              {log.ott ? (
                <>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="text-indigo-600/80">{log.ott}</span>
                </>
              ) : null}
            </div>
          </div>
          {typeof log.rating === "number" ? (
            <div className="shrink-0 rounded-xl bg-foreground px-2.5 py-1 text-xs font-bold text-background shadow-sm">
              {log.rating.toFixed(1)}
            </div>
          ) : null}
        </div>
        {log.place || log.occasion ? (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {log.place
              ? chip(
                  placeLabel(log.place, (k: any) =>
                    tCommon(`placeLabels.${k}`),
                  ),
                  "place",
                )
              : null}
            {log.occasion
              ? chip(
                  occasionLabel(log.occasion, (k: any) =>
                    tCommon(`occasionLabels.${k}`),
                  ),
                  "occasion",
                )
              : null}
          </div>
        ) : null}
        {log.note ? (
          <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
            {renderBody(formatNoteInline(log.note))}
          </p>
        ) : null}
      </div>
    </article>
  );
}
