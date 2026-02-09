"use client";

import { useEffect, useState } from "react";
import { listAllLogsLocal } from "@/lib/localStore";
import { buildPersonalReport, PersonalReport } from "@/lib/report";
import { OCCASION_LABELS, PLACE_LABELS } from "@/lib/utils";
import { api } from "@/lib/api";

function typeLabel(type: string) {
  if (type === "movie") return "영화";
  if (type === "series") return "시리즈";
  if (type === "book") return "책";
  return "-";
}

export default function MyReportPage() {
  const [report, setReport] = useState<PersonalReport | null>(null);
  const [source, setSource] = useState<"server" | "local">("server");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const serverReport = await api<PersonalReport>("/analytics/me/report");
        setReport(serverReport);
        setSource("server");
      } catch (e: any) {
        try {
          const items = await listAllLogsLocal();
          setReport(buildPersonalReport(items));
          setSource("local");
        } catch (fallbackError: any) {
          setError(fallbackError?.message ?? e?.message ?? "리포트를 불러오지 못했어요.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="text-sm text-muted-foreground">리포트를 계산하고 있어요...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500">{error}</div>;
  }
  if (!report) {
    return <div className="text-sm text-muted-foreground">리포트 데이터가 없습니다.</div>;
  }

  const place = report.topPlace !== "-" ? PLACE_LABELS[report.topPlace as keyof typeof PLACE_LABELS] ?? report.topPlace : "-";
  const occasion = report.topOccasion !== "-"
    ? OCCASION_LABELS[report.topOccasion as keyof typeof OCCASION_LABELS] ?? report.topOccasion
    : "-";

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">내 이용 리포트</h1>
        <p className="text-sm text-muted-foreground">
          {source === "server" ? "서버에 동기화된 기록을 기준으로 집계한 개인 리포트입니다." : "로컬 기록 기준으로 임시 집계한 리포트입니다."}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">총 기록</div>
          <div className="mt-1 text-2xl font-semibold">{report.totalLogs}</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">이번 달 기록</div>
          <div className="mt-1 text-2xl font-semibold">{report.thisMonthLogs}</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">완료율</div>
          <div className="mt-1 text-2xl font-semibold">{report.doneRatePct}%</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">평점 입력률</div>
          <div className="mt-1 text-2xl font-semibold">{report.ratingFillPct}%</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">메모 입력률</div>
          <div className="mt-1 text-2xl font-semibold">{report.noteFillPct}%</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">최근 기록일</div>
          <div className="mt-1 text-base font-semibold">
            {report.lastLoggedAt ? new Date(report.lastLoggedAt).toLocaleDateString("ko-KR") : "-"}
          </div>
        </article>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">가장 많이 기록한 타입</div>
          <div className="mt-1 text-lg font-semibold">{typeLabel(report.topType)}</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">자주 기록한 장소</div>
          <div className="mt-1 text-lg font-semibold">{place}</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">자주 함께한 방식</div>
          <div className="mt-1 text-lg font-semibold">{occasion}</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4 sm:col-span-2 lg:col-span-3">
          <div className="text-xs text-muted-foreground">연속 기록</div>
          <div className="mt-1 text-lg font-semibold">
            현재 {report.streakDays}일 · 최장 {report.longestStreakDays}일
          </div>
        </article>
      </section>

    </div>
  );
}
