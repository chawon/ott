"use client";

import { ArrowLeft, FileUp, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Link as IntlLink } from "@/i18n/routing";
import { listAllLogsLocal, listNetflixViewingsLocal } from "@/lib/localStore";
import type { NetflixViewingEvent } from "@/lib/netflixImport";
import { syncOutbox } from "@/lib/sync";
import type { WatchLog } from "@/lib/types";

function formatDay(day: string, locale: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(
    locale === "ko" ? "ko-KR" : "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    },
  );
}

export default function NetflixHistoryPage() {
  const t = useTranslations("NetflixImport");
  const locale = useLocale();
  const [events, setEvents] = useState<NetflixViewingEvent[]>([]);
  const [logs, setLogs] = useState<WatchLog[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const [viewings, savedLogs] = await Promise.all([
        listNetflixViewingsLocal(),
        listAllLogsLocal(),
      ]);
      if (!cancelled) {
        setEvents(viewings);
        setLogs(savedLogs);
        setLoading(false);
      }
    }
    void refresh();
    void syncOutbox()
      .then(refresh)
      .catch(() => setLoading(false));
    window.addEventListener("sync:updated", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("sync:updated", refresh);
    };
  }, []);

  const groups = useMemo(() => {
    const logByTitle = new Map(logs.map((log) => [log.title.id, log]));
    const filtered = events.filter((event) => {
      if (!query.trim()) return true;
      const search = query.trim().toLocaleLowerCase();
      return (
        event.workTitle.toLocaleLowerCase().includes(search) ||
        event.rawTitle.toLocaleLowerCase().includes(search)
      );
    });
    const grouped = new Map<
      string,
      {
        title: string;
        linkedTitleId: string | null;
        events: NetflixViewingEvent[];
      }
    >();
    for (const event of filtered) {
      const key = event.linkedTitleId ?? `raw:${event.workTitle}`;
      const found = grouped.get(key);
      if (found) found.events.push(event);
      else
        grouped.set(key, {
          title: event.linkedTitleId
            ? (logByTitle.get(event.linkedTitleId)?.title.name ??
              event.workTitle)
            : event.workTitle,
          linkedTitleId: event.linkedTitleId,
          events: [event],
        });
    }
    return [...grouped.values()].sort(
      (a, b) =>
        b.events[0].viewedOn.localeCompare(a.events[0].viewedOn) ||
        a.title.localeCompare(b.title),
    );
  }, [events, logs, query]);

  function episodeLabel(event: NetflixViewingEvent) {
    if (event.seasonNumber !== null && event.episodeNumber !== null) {
      return t("historySeasonEpisode", {
        season: event.seasonNumber,
        episode: event.episodeNumber,
      });
    }
    if (event.seasonNumber !== null)
      return t("historySeason", { season: event.seasonNumber });
    if (event.episodeNumber !== null)
      return t("historyEpisode", { episode: event.episodeNumber });
    return null;
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 pb-12">
      <IntlLink
        href="/timeline"
        className="inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-[#1E4D8C] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/60 dark:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("backToTimeline")}
      </IntlLink>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("historyTitle")}
        </h1>
        <p className="text-base text-muted-foreground">{t("historyDesc")}</p>
      </header>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex min-h-12 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-[#FF9933]/60">
          <Search
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("historySearch")}
            aria-label={t("historySearch")}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
          />
        </label>
        <IntlLink
          href="/account/import/netflix"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#1E4D8C]/40 bg-card px-4 text-sm font-semibold text-[#1E4D8C] hover:bg-ott-paper-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/60 dark:text-foreground"
        >
          <FileUp className="h-4 w-4" aria-hidden="true" />
          {t("historyImportMore")}
        </IntlLink>
      </div>

      {!loading && events.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {t("historyEmpty")}
        </p>
      ) : null}
      <div className="space-y-3">
        {groups.map((group) => (
          <article
            key={group.linkedTitleId ?? `raw:${group.title}`}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                {group.linkedTitleId ? (
                  <IntlLink
                    href={`/title/${group.linkedTitleId}`}
                    className="text-base font-semibold text-foreground hover:underline"
                  >
                    {group.title}
                  </IntlLink>
                ) : (
                  <h2 className="text-base font-semibold text-foreground">
                    {group.title}
                  </h2>
                )}
                <p className="text-xs text-muted-foreground">
                  {group.linkedTitleId
                    ? t("historyLinked")
                    : t("historySeparate")}
                </p>
              </div>
              <span className="rounded-lg bg-[#FAF5D7] px-2 py-1 text-xs font-medium text-[#4A4A4A]">
                {t("historyCount", { count: group.events.length })}
              </span>
            </div>
            <details className="mt-3 border-t border-border pt-3">
              <summary className="min-h-10 cursor-pointer text-sm font-semibold text-[#1E4D8C] dark:text-foreground">
                {formatDay(group.events[0].viewedOn, locale)} ·{" "}
                {t("historyCount", { count: group.events.length })}
              </summary>
              <ol className="max-h-80 space-y-2 overflow-y-auto pt-2">
                {group.events.map((event) => (
                  <li
                    key={event.sourceKey}
                    className="rounded-lg bg-ott-paper p-3 text-sm"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {event.rawTitle}
                      </span>
                      <span className="text-muted-foreground">
                        {formatDay(event.viewedOn, locale)}
                      </span>
                    </div>
                    <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
                      {episodeLabel(event) ? (
                        <span>{episodeLabel(event)}</span>
                      ) : null}
                      {event.syncStatus !== "synced" ? (
                        <span>{t("historyPending")}</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </details>
          </article>
        ))}
      </div>
    </main>
  );
}
