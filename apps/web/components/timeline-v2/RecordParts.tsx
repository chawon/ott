"use client";

import { BookOpen, CalendarDays, Film, MapPin, Tv, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import FeelingIcon from "@/components/FeelingIcon";
import { originalBookCoverUrl } from "@/lib/bookCover";
import type { WatchLog } from "@/lib/types";
import { occasionLabel, placeLabel, ratingDisplay } from "@/lib/utils";
import styles from "./timeline.module.css";

export function recordDate(log: WatchLog) {
  const date = new Date(log.watchedAt || log.createdAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function monthKey(date: Date | null) {
  return date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    : "undated";
}

export function monthLabel(key: string, locale: string, short = false) {
  if (key === "undated") return locale === "ko" ? "날짜 미기록" : "Undated";
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    ...(short ? {} : { year: "numeric" as const }),
    month: short ? "short" : "long",
  }).format(new Date(`${key}-01T12:00:00`));
}

function tmdbPosterUrl(source: string, size: string) {
  try {
    const url = new URL(source);
    if (
      url.hostname !== "image.tmdb.org" ||
      !/^\/t\/p\/(?:w\d+|original)\//.test(url.pathname)
    )
      return null;
    url.pathname = url.pathname.replace(
      /\/t\/p\/(?:w\d+|original)\//,
      `/t/p/${size}/`,
    );
    return url.toString();
  } catch {
    return null;
  }
}

export function RecordPoster({
  log,
  className = "",
  variant = "row",
}: {
  log: WatchLog;
  className?: string;
  variant?: "featured" | "row" | "compact";
}) {
  const source = log.seasonPosterUrl || log.title.posterUrl;
  const [failure, setFailure] = useState<{
    source: string;
    stage: "primary" | "fallback";
  } | null>(null);
  const isBook = log.title.type === "book";
  const bookOriginal =
    source && isBook && variant === "featured"
      ? originalBookCoverUrl(source)
      : null;
  const resized =
    source && !isBook
      ? tmdbPosterUrl(source, variant === "featured" ? "w500" : "w342")
      : null;
  const original = source ? tmdbPosterUrl(source, "original") || source : null;
  const originalFallback =
    failure?.source === source && failure?.stage === "primary";
  const failed = failure?.source === source && failure?.stage === "fallback";
  const srcSet =
    source && resized && !originalFallback
      ? [342, 500, 780, 1280]
          .map((width) => `${tmdbPosterUrl(source, `w${width}`)} ${width}w`)
          .join(", ")
      : undefined;
  const sizes =
    variant === "featured"
      ? "(max-width: 380px) 82px, (max-width: 767.98px) 100px, (max-width: 1100px) 40vw, 390px"
      : variant === "compact"
        ? "54px"
        : "(max-width: 380px) 48px, (max-width: 767.98px) 58px, 84px";
  const Icon = isBook ? BookOpen : log.title.type === "series" ? Tv : Film;
  return (
    <div
      className={`${styles.poster} ${className}`}
      data-media-type={log.title.type}
      data-poster-variant={variant}
    >
      {source && !failed ? (
        <img
          src={
            (originalFallback ? original : bookOriginal || resized || source) ||
            source
          }
          srcSet={srcSet}
          sizes={srcSet ? sizes : undefined}
          alt=""
          loading={variant === "featured" ? "eager" : "lazy"}
          fetchPriority={variant === "featured" ? "high" : "auto"}
          onError={() =>
            setFailure({
              source,
              stage:
                (resized || bookOriginal) && !originalFallback
                  ? "primary"
                  : "fallback",
            })
          }
        />
      ) : (
        <span className={styles.posterFallback}>
          <Icon aria-hidden="true" />
          <span>{log.title.name}</span>
        </span>
      )}
    </div>
  );
}

export function RecordFeeling({ log }: { log: WatchLog }) {
  const t = useTranslations("QuickLogCard");
  const feeling = ratingDisplay(log.rating, log.title.type, t);
  if (
    !feeling ||
    !Number.isFinite(log.rating) ||
    (log.rating ?? 0) <= 0 ||
    (log.rating ?? 0) > 5
  )
    return null;
  return (
    <span className={styles.feeling}>
      <FeelingIcon value={feeling.value} type={log.title.type} />
      {feeling.label}
    </span>
  );
}

export function RecordMoment({
  log,
  showDate = false,
}: {
  log: WatchLog;
  showDate?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("Common");
  const date = recordDate(log);
  if (!showDate && !log.ott && !log.place && !log.occasion) return null;
  return (
    <div className={styles.moment}>
      {showDate && date ? (
        <span>
          <CalendarDays aria-hidden="true" />
          <time dateTime={log.watchedAt || log.createdAt}>
            {date.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </time>
        </span>
      ) : null}
      {log.ott ? (
        <span>
          <Tv aria-hidden="true" />
          {log.ott}
        </span>
      ) : null}
      {log.place ? (
        <span>
          <MapPin aria-hidden="true" />
          {placeLabel(log.place, (key: string) => t(`placeLabels.${key}`))}
        </span>
      ) : null}
      {log.occasion ? (
        <span>
          <Users aria-hidden="true" />
          {occasionLabel(log.occasion, (key: string) =>
            t(`occasionLabels.${key}`),
          )}
        </span>
      ) : null}
    </div>
  );
}

export function RecordEdition({ log }: { log: WatchLog }) {
  if (
    typeof log.seasonNumber !== "number" &&
    typeof log.episodeNumber !== "number"
  )
    return null;
  return (
    <span>
      {[
        typeof log.seasonNumber === "number" ? `S${log.seasonNumber}` : null,
        typeof log.episodeNumber === "number" ? `E${log.episodeNumber}` : null,
      ]
        .filter(Boolean)
        .join(" · ")}
    </span>
  );
}
