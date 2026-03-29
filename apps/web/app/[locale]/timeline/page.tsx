"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Download } from "lucide-react";
import FiltersBar from "@/components/FiltersBar";
import LogCard from "@/components/LogCard";
import { apiWithAuth } from "@/lib/api";
import { getUserId, listLogsLocal, upsertLogsLocal } from "@/lib/localStore";
import { Status, WatchLog } from "@/lib/types";
import { cn, statusOptionsForType } from "@/lib/utils";
import { downloadTimelineCsv } from "@/lib/export";
import { useTranslations } from "next-intl";

function buildQuery(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v.trim()) qs.set(k, v.trim());
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default function TimelinePage() {
  const tTimeline = useTranslations("Timeline");
  const tStatus = useTranslations("Status");
  const tCommon = useTranslations("Common");
  const tCsv = useTranslations("CSV");
  const tQuick = useTranslations("QuickLogCard");
  const tAccount = useTranslations("Account");
  const [status, setStatus] = useState<Status | "ALL">("ALL");
  const [contentType, setContentType] = useState<"ALL" | "video" | "book">(
    "ALL",
  );
  const [origin, setOrigin] = useState<"ALL" | "LOG" | "COMMENT">("ALL");
  const [ott, setOtt] = useState("");
  const [logs, setLogs] = useState<WatchLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  useEffect(() => {
    if (contentType === "ALL") {
      setStatus("ALL");
    }
    setOtt("");
  }, [contentType]);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      let hadLocal = false;

      try {
        const cached = await listLogsLocal({
          limit: 50,
          contentType: contentType === "ALL" ? undefined : contentType,
          status: status === "ALL" ? undefined : status,
          origin: origin === "ALL" ? undefined : origin,
          ott: ott.trim() ? ott : undefined,
          sortBy: "history",
        });
        if (!cancelled) {
          if (cached.length > 0) hadLocal = true;
          setLogs(cached);
        }

        const query = buildQuery({
          limit: "50",
          status: status === "ALL" ? undefined : status,
          origin: origin === "ALL" ? undefined : origin,
          ott: ott.trim() ? ott : undefined,
          sort: "history",
        });

        if (getUserId()) {
          const res = await apiWithAuth<WatchLog[]>(`/logs${query}`);
          await upsertLogsLocal(res);
          const refreshed = await listLogsLocal({
            limit: 50,
            contentType: contentType === "ALL" ? undefined : contentType,
            status: status === "ALL" ? undefined : status,
            origin: origin === "ALL" ? undefined : origin,
            ott: ott.trim() ? ott : undefined,
            sortBy: "history",
          });
          if (!cancelled) setLogs(refreshed);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message ?? "Failed to load logs");
          if (!hadLocal) setLogs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status, ott, origin, contentType]);

  useEffect(() => {
    function handleSync() {
      listLogsLocal({
        limit: 50,
        contentType: contentType === "ALL" ? undefined : contentType,
        status: status === "ALL" ? undefined : status,
        origin: origin === "ALL" ? undefined : origin,
        ott: ott.trim() ? ott : undefined,
        sortBy: "history",
      }).then((cached) => setLogs(cached));
    }
    window.addEventListener("sync:updated", handleSync);
    return () => window.removeEventListener("sync:updated", handleSync);
  }, [status, ott, origin, contentType]);

  const headerTitle = tTimeline("titleModern");
  const headerSubtitle = useMemo(() => {
    if (loading) return tTimeline("loading");
    if (err) return err;
    return tTimeline("subtitleModern");
  }, [loading, err, tTimeline]);

  const statusLabel = useMemo(() => {
    if (status === "ALL") return null;
    const labels = statusOptionsForType(
      contentType === "book" ? "book" : "movie",
    );
    return labels.find((s) => s.value === status)?.label ?? null;
  }, [contentType, status]);

  function exportFileName() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `watchlog-timeline-${y}${m}${d}-${hh}${mm}.csv`;
  }

  async function exportTimelineCsv() {
    setExporting(true);
    setExportStatus(null);
    try {
      const filtered = await listLogsLocal({
        contentType: contentType === "ALL" ? undefined : contentType,
        status: status === "ALL" ? undefined : status,
        origin: origin === "ALL" ? undefined : origin,
        ott: ott.trim() ? ott : undefined,
        sortBy: "history",
      });
      if (filtered.length === 0) {
        setExportStatus(tAccount("statusNoMatchingLogs"));
        return;
      }
      downloadTimelineCsv(
        filtered,
        exportFileName(),
        tCsv,
        tStatus,
        tCommon,
        tQuick,
      );
      setExportStatus(tAccount("statusExportSuccess"));
    } catch (e: any) {
      setExportStatus(e?.message ?? tAccount("statusExportFailed"));
    } finally {
      setExporting(false);
    }
  }

  const enableYearGrouping = logs.length > 0;
  const yearGroups = useMemo(() => {
    if (!enableYearGrouping) return [];
    const groups: { year: number; items: WatchLog[] }[] = [];
    const index = new Map<number, number>();
    for (const log of logs) {
      const base = log.updatedAt ?? log.watchedAt ?? log.createdAt;
      const year = new Date(base).getFullYear();
      const existing = index.get(year);
      if (existing === undefined) {
        index.set(year, groups.length);
        groups.push({ year, items: [log] });
      } else {
        groups[existing].items.push(log);
      }
    }
    return groups;
  }, [enableYearGrouping, logs]);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <div className="text-xl font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {headerTitle}
          </div>
          <button
            type="button"
            onClick={exportTimelineCsv}
            disabled={exporting}
            title={tTimeline("exportCsv")}
            aria-label={tTimeline("exportCsv")}
            className={cn(
              "rounded-lg border border-border bg-card px-2 py-1 text-muted-foreground hover:bg-muted",
              exporting && "opacity-40",
            )}
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
        <div className="text-sm text-muted-foreground">
          {headerSubtitle}
        </div>
        {exportStatus ? (
          <div className="text-sm text-muted-foreground">
            {exportStatus}
          </div>
        ) : null}
      </div>

      <FiltersBar
        status={status}
        setStatus={setStatus}
        origin={origin}
        setOrigin={setOrigin}
        ott={ott}
        setOtt={setOtt}
        contentType={contentType}
        setContentType={setContentType}
      />

      {loading && logs.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          {tTimeline("loading")}
        </div>
      )}

      {!loading && logs.length === 0 && !err && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          {tTimeline("emptyModern")}
        </div>
      )}

      {enableYearGrouping ? (
        <div className="space-y-6">
          {yearGroups.map((group) => (
            <div key={group.year} className="space-y-3">
              <div className="text-sm font-semibold text-muted-foreground">
                {status === "ALL" ? (
                  <>
                    <span className="font-bold text-slate-700">
                      {group.year}
                    </span>
                    <span> </span>
                    <span className="font-bold text-indigo-600">
                      ({group.items.length})
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-slate-700">
                      {tTimeline("yearFormat", { year: group.year })}
                    </span>
                    <span>{tTimeline("yearSuffix")}</span>
                    <span className="font-bold text-indigo-600">
                      {group.items.length}
                    </span>
                    <span>
                      {contentType === "book" ? tTimeline("unitBook") : tTimeline("unitVideo")}
                      {statusLabel || tStatus("DONE")}
                    </span>
                  </>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3">
                {group.items.map((l) => (
                  <LogCard key={l.id} log={l} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {logs.map((l) => (
            <LogCard key={l.id} log={l} />
          ))}
        </div>
      )}
    </div>
  );
}
