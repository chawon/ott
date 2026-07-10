"use client";

import { Download, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { api } from "@/lib/api";
import { listAllLogsLocal } from "@/lib/localStore";
import { isProfileComplete } from "@/lib/profile";
import { buildPersonalReport, type PersonalReport } from "@/lib/report";
import {
  downloadBlob,
  fetchShareCardBlob,
  type RecapShareCardPayload,
  shareBlob,
} from "@/lib/share";
import type { Occasion, Place } from "@/lib/types";
import { useUserProfile } from "@/lib/useUserProfile";
import { occasionLabel, placeLabel, tmdbResize } from "@/lib/utils";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}

export default function MyReportPage() {
  const t = useTranslations("Report");
  const tCommon = useTranslations("Common");
  const tQuick = useTranslations("QuickLogCard");
  const tProfile = useTranslations("Profile");
  const locale = useLocale();
  const [report, setReport] = useState<PersonalReport | null>(null);
  const { profile } = useUserProfile();

  function typeLabel(type: string) {
    if (type === "movie") return tQuick("typeMovie");
    if (type === "series") return tQuick("typeSeriesModern");
    if (type === "book") return tQuick("typeBook");
    return "-";
  }

  const [source, setSource] = useState<"server" | "local">("server");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState<
    "weekly" | "monthly" | "half-year" | null
  >(null);
  const h1ImpressionTracked = useRef(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const serverReport = await api<PersonalReport>("/nalytic/me/report");
        setReport(serverReport);
        setSource("server");
      } catch (e) {
        try {
          const items = await listAllLogsLocal();
          setReport(buildPersonalReport(items));
          setSource("local");
        } catch (fallbackError) {
          setError(
            errorMessage(fallbackError) ?? errorMessage(e) ?? t("loadError"),
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const seasonalRecapForTracking = report?.seasonalRecap ?? null;
  useEffect(() => {
    if (!seasonalRecapForTracking || h1ImpressionTracked.current) return;
    h1ImpressionTracked.current = true;
    void trackEvent("h1_recap_impression", {
      recapKey: seasonalRecapForTracking.key,
      totalLogs: seasonalRecapForTracking.totalLogs,
      posterCount: seasonalRecapForTracking.posters.length,
    });
  }, [seasonalRecapForTracking]);

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">{t("calculating")}</div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-500">{error}</div>;
  }
  if (!report) {
    return <div className="text-sm text-muted-foreground">{t("noData")}</div>;
  }

  const placeText =
    report.topPlace !== "-"
      ? placeLabel(report.topPlace as Place, (k: Place) =>
          tCommon(`placeLabels.${k}`),
        )
      : "-";
  const occasionText =
    report.topOccasion !== "-"
      ? occasionLabel(report.topOccasion as Occasion, (k: Occasion) =>
          tCommon(`occasionLabels.${k}`),
        )
      : "-";
  const profileComplete = isProfileComplete(profile);
  const reportTitle = profileComplete
    ? t("personalizedTitle", { nickname: profile?.nickname ?? "" })
    : t("title");
  const personaLabel = profileComplete
    ? tProfile(`personas.${profile?.personaKey}`)
    : null;
  const previousWeekLogs = report.previousWeekLogs ?? 0;
  const monthlyTopGenre = report.monthlyTopGenre ?? "-";
  const monthlyTopGenreCount = report.monthlyTopGenreCount ?? 0;
  const daysSinceLastLog = report.daysSinceLastLog ?? 0;
  const continueSeriesTitle = report.continueSeriesTitle ?? null;
  const continueSeriesEpisode =
    typeof report.continueSeriesSeasonNumber === "number" &&
    typeof report.continueSeriesEpisodeNumber === "number"
      ? `S${report.continueSeriesSeasonNumber} · E${report.continueSeriesEpisodeNumber}`
      : typeof report.continueSeriesSeasonNumber === "number"
        ? `S${report.continueSeriesSeasonNumber}`
        : typeof report.continueSeriesEpisodeNumber === "number"
          ? `E${report.continueSeriesEpisodeNumber}`
          : null;

  async function handleRecapShare(kind: "weekly" | "monthly" | "half-year") {
    if (!report || shareBusy) return;
    try {
      setShareBusy(kind);
      const payload = buildRecapSharePayload(kind);
      const blob = await fetchShareCardBlob(payload);
      const filename = `ottline-${kind}-recap.png`;
      const title = payload.title;
      const shared = await shareBlob(
        blob,
        filename,
        title,
        t("recapShareText", { title }),
      );
      if (!shared) {
        await downloadBlob(blob, filename);
      }
      if (kind === "half-year") {
        await trackEvent("h1_recap_share", {
          totalLogs: report.seasonalRecap?.totalLogs ?? 0,
          posterCount: report.seasonalRecap?.posters.length ?? 0,
          source,
        });
      }
    } finally {
      setShareBusy(null);
    }
  }

  function buildRecapSharePayload(
    kind: "weekly" | "monthly" | "half-year",
  ): RecapShareCardPayload {
    const currentReport = report;
    if (!currentReport) {
      throw new Error("Report is not ready");
    }
    if (kind === "half-year") {
      const recap = currentReport.seasonalRecap;
      if (!recap) throw new Error("Seasonal recap is not ready");
      return {
        cardType: "recap",
        recapKind: "half-year",
        format: "story",
        title: t("h1RecapCardTitle"),
        subtitle: t("h1RecapCardSubtitle", { count: recap.totalLogs }),
        periodLabel: t("h1RecapPeriod"),
        posterItems: recap.posters.map((item) => ({
          title: item.title,
          titleType: item.titleType,
          posterUrl: item.posterUrl ?? null,
          count: item.count,
        })),
        stats: [
          { label: t("h1TotalRecords"), value: String(recap.totalLogs) },
          { label: t("h1TopType"), value: typeLabel(recap.topType) },
          { label: t("h1NoteRate"), value: `${recap.noteFillPct}%` },
        ],
        footer: t("h1RecapFooter"),
        watermark: "ottline.app",
        theme: "default",
      };
    }
    if (kind === "weekly") {
      return {
        cardType: "recap",
        recapKind: "weekly",
        format: "story",
        title: t("weeklyRecapCardTitle"),
        subtitle: t("weeklyRecapCardSubtitle", {
          count: previousWeekLogs,
        }),
        stats: [
          { label: t("weeklyRecords"), value: String(previousWeekLogs) },
          { label: t("totalRecords"), value: String(currentReport.totalLogs) },
          { label: t("streak"), value: String(currentReport.streakDays) },
        ],
        footer: "ottline.app",
        watermark: "ottline.app",
        theme: "default",
      };
    }

    return {
      cardType: "recap",
      recapKind: "monthly",
      format: "story",
      title: t("monthlyRecapCardTitle"),
      subtitle:
        monthlyTopGenre !== "-"
          ? t("monthlyRecapCardSubtitle", {
              genre: monthlyTopGenre,
              count: monthlyTopGenreCount,
            })
          : t("monthlyRecapCardSubtitleEmpty"),
      stats: [
        {
          label: t("monthlyRecords"),
          value: String(currentReport.thisMonthLogs),
        },
        {
          label: t("monthlyTopGenre"),
          value: monthlyTopGenre !== "-" ? monthlyTopGenre : "-",
        },
        { label: t("memoRate"), value: `${currentReport.noteFillPct}%` },
      ],
      footer: "ottline.app",
      watermark: "ottline.app",
      theme: "default",
    };
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{reportTitle}</h1>
        {personaLabel ? (
          <p className="text-sm font-medium text-[#1E4D8C] dark:text-muted-foreground">
            {t("profileNotice", { persona: personaLabel })}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {source === "server" ? t("syncNotice") : t("localNotice")}
        </p>
      </section>

      {report.seasonalRecap ? (
        <section
          id="seasonal-recap"
          className="scroll-mt-40 overflow-hidden rounded-lg bg-[#FEF9EE] shadow-sm"
        >
          <div className="grid gap-0 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="grid min-h-[280px] grid-cols-3 gap-1 bg-[#ECEBE9] p-1 sm:min-h-[320px]">
              {report.seasonalRecap.posters.slice(0, 6).map((item, index) => (
                <div
                  key={`${item.titleId}-${index}`}
                  className="relative overflow-hidden rounded-md bg-[#0F0F0F]"
                >
                  {item.posterUrl ? (
                    <img
                      src={tmdbResize(item.posterUrl, "w342") ?? item.posterUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-end bg-[#FAF5D7] p-3">
                      <span className="line-clamp-3 text-sm font-semibold text-[#0F0F0F]">
                        {item.title}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-col justify-between gap-6 p-5 sm:p-6">
              <div className="space-y-3">
                <div className="text-xs font-semibold text-[#4A4A4A]">
                  {t("h1RecapPeriod")}
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight text-[#0F0F0F]">
                    {t("h1RecapTitle")}
                  </h2>
                  <p className="text-sm leading-6 text-[#4A4A4A]">
                    {t("h1RecapDesc", {
                      count: report.seasonalRecap.totalLogs,
                    })}
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg bg-white p-3">
                  <div className="text-xs text-[#4A4A4A]">
                    {t("h1TotalRecords")}
                  </div>
                  <div className="mt-1 text-xl font-semibold text-[#0F0F0F]">
                    {report.seasonalRecap.totalLogs}
                  </div>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <div className="text-xs text-[#4A4A4A]">{t("h1TopType")}</div>
                  <div className="mt-1 text-base font-semibold text-[#0F0F0F]">
                    {typeLabel(report.seasonalRecap.topType)}
                  </div>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <div className="text-xs text-[#4A4A4A]">
                    {t("h1NoteRate")}
                  </div>
                  <div className="mt-1 text-xl font-semibold text-[#0F0F0F]">
                    {report.seasonalRecap.noteFillPct}%
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRecapShare("half-year")}
                disabled={shareBusy !== null}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#FF9933] px-5 py-3 text-sm font-semibold text-[#0F0F0F] transition-colors hover:bg-[#e88724] disabled:opacity-50"
              >
                <Share2 className="h-4 w-4" />
                {shareBusy === "half-year" ? t("sharing") : t("h1ShareAction")}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">
            {t("totalRecords")}
          </div>
          <div className="mt-1 text-2xl font-semibold">{report.totalLogs}</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">
            {t("monthlyRecords")}
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {report.thisMonthLogs}
          </div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">
            {t("completionRate")}
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {report.doneRatePct}%
          </div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("ratingRate")}</div>
          <div className="mt-1 text-2xl font-semibold">
            {report.ratingFillPct}%
          </div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("memoRate")}</div>
          <div className="mt-1 text-2xl font-semibold">
            {report.noteFillPct}%
          </div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("recentDate")}</div>
          <div className="mt-1 text-base font-semibold">
            {report.lastLoggedAt
              ? new Date(report.lastLoggedAt).toLocaleDateString(
                  locale === "ko" ? "ko-KR" : "en-US",
                  {
                    timeZone: "Asia/Seoul",
                  },
                )
              : "-"}
          </div>
        </article>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t("revisitTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("revisitDesc")}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">
              {t("weeklyRecords")}
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {previousWeekLogs}
            </div>
            <button
              type="button"
              onClick={() => handleRecapShare("weekly")}
              disabled={shareBusy !== null}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              <Share2 className="h-3.5 w-3.5" />
              {shareBusy === "weekly" ? t("sharing") : t("weeklyShareAction")}
            </button>
          </article>
          <article className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">
              {t("monthlyTopGenre")}
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {monthlyTopGenre !== "-" ? monthlyTopGenre : "-"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {monthlyTopGenre !== "-"
                ? t("monthlyTopGenreDesc", { count: monthlyTopGenreCount })
                : t("monthlyTopGenreEmpty")}
            </p>
            <button
              type="button"
              onClick={() => handleRecapShare("monthly")}
              disabled={shareBusy !== null}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {shareBusy === "monthly" ? t("sharing") : t("monthlyShareAction")}
            </button>
          </article>
          <article className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">
              {t("daysSinceLastLog")}
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {t("daysSinceLastLogValue", { count: daysSinceLastLog })}
            </div>
          </article>
          <article className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">
              {t("continueSeries")}
            </div>
            <div className="mt-1 text-lg font-semibold">
              {continueSeriesTitle ?? t("continueSeriesEmpty")}
            </div>
            {continueSeriesEpisode ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {continueSeriesEpisode}
              </p>
            ) : null}
          </article>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">
            {t("mostLoggedType")}
          </div>
          <div className="mt-1 text-lg font-semibold">
            {typeLabel(report.topType)}
          </div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">
            {t("frequentPlace")}
          </div>
          <div className="mt-1 text-lg font-semibold">{placeText}</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">
            {t("frequentOccasion")}
          </div>
          <div className="mt-1 text-lg font-semibold">{occasionText}</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4 sm:col-span-2 lg:col-span-3">
          <div className="text-xs text-muted-foreground">{t("streak")}</div>
          <div className="mt-1 text-lg font-semibold">
            {t("streakDesc", {
              current: report.streakDays,
              longest: report.longestStreakDays,
            })}
          </div>
        </article>
      </section>
    </div>
  );
}
