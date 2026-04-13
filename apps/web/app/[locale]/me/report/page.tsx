"use client";

import { useEffect, useState } from "react";
import { listAllLogsLocal } from "@/lib/localStore";
import { buildPersonalReport, PersonalReport } from "@/lib/report";
import {
  OCCASION_LABELS,
  PLACE_LABELS,
  placeLabel,
  occasionLabel,
} from "@/lib/utils";
import { api } from "@/lib/api";
import { useLocale, useTranslations } from "next-intl";
import { Occasion, Place } from "@/lib/types";

export default function MyReportPage() {
  const t = useTranslations("Report");
  const tCommon = useTranslations("Common");
  const tQuick = useTranslations("QuickLogCard");
  const locale = useLocale();
  const [report, setReport] = useState<PersonalReport | null>(null);

  function typeLabel(type: string) {
    if (type === "movie") return tQuick("typeMovie");
    if (type === "series") return tQuick("typeSeriesModern");
    if (type === "book") return tQuick("typeBook");
    return "-";
  }

  const [source, setSource] = useState<"server" | "local">("server");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const serverReport = await api<PersonalReport>("/nalytic/me/report");
        setReport(serverReport);
        setSource("server");
      } catch (e: any) {
        try {
          const items = await listAllLogsLocal();
          setReport(buildPersonalReport(items));
          setSource("local");
        } catch (fallbackError: any) {
          setError(
            fallbackError?.message ??
              e?.message ??
              t("loadError"),
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("calculating")}
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-500">{error}</div>;
  }
  if (!report) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("noData")}
      </div>
    );
  }

  const placeText =
    report.topPlace !== "-"
      ? placeLabel(report.topPlace as Place, (k: any) => tCommon("placeLabels." + k))
      : "-";
  const occasionText =
    report.topOccasion !== "-"
      ? occasionLabel(report.topOccasion as Occasion, (k: any) => tCommon("occasionLabels." + k))
      : "-";

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {source === "server"
            ? t("syncNotice")
            : t("localNotice")}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("totalRecords")}</div>
          <div className="mt-1 text-2xl font-semibold">{report.totalLogs}</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("monthlyRecords")}</div>
          <div className="mt-1 text-2xl font-semibold">
            {report.thisMonthLogs}
          </div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("completionRate")}</div>
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
          <div className="text-xs text-muted-foreground">{t("frequentPlace")}</div>
          <div className="mt-1 text-lg font-semibold">{placeText}</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("frequentOccasion")}</div>
          <div className="mt-1 text-lg font-semibold">{occasionText}</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4 sm:col-span-2 lg:col-span-3">
          <div className="text-xs text-muted-foreground">{t("streak")}</div>
          <div className="mt-1 text-lg font-semibold">
            {t("streakDesc", { current: report.streakDays, longest: report.longestStreakDays })}
          </div>
        </article>
      </section>
    </div>
  );
}
