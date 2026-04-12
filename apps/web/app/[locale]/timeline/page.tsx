"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Download, Sparkles, X } from "lucide-react";
import Image from "next/image";
import FiltersBar from "@/components/FiltersBar";
import LogCard from "@/components/LogCard";
import { apiWithAuth } from "@/lib/api";
import { getUserId, listLogsLocal, upsertLogsLocal } from "@/lib/localStore";
import { RecommendationItem, Status, WatchLog } from "@/lib/types";
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

const FUTURE_LOADING_MESSAGES_KO = [
  "AI가 당신의 취향을 분석하는 중...",
  "시청 기록에서 패턴을 찾는 중...",
  "다음에 볼 작품을 예언하는 중...",
  "미래의 타임라인을 그리는 중...",
  "포스터를 가져오는 중...",
];
const FUTURE_LOADING_MESSAGES_EN = [
  "AI is analyzing your taste...",
  "Finding patterns in your history...",
  "Predicting your next watch...",
  "Drawing your future timeline...",
  "Fetching posters...",
];

function FutureLoadingSkeleton({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [msgIdx, setMsgIdx] = useState(0);
  const messages = t("futureTitle").includes("미래")
    ? FUTURE_LOADING_MESSAGES_KO
    : FUTURE_LOADING_MESSAGES_EN;

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIdx((i) => (i + 1) % messages.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [messages.length]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-primary px-1">
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
        <span className="transition-all duration-500">{messages[msgIdx]}</span>
      </div>

      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-dashed border-primary/20 bg-card/60 shadow-sm overflow-hidden"
        >
          <div className="flex gap-3 p-3">
            <div className="shrink-0 h-[84px] w-[56px] rounded-lg bg-muted animate-pulse" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/4 rounded-full bg-muted animate-pulse" />
              <div className="flex gap-1">
                <div className="h-3 w-10 rounded-full bg-muted animate-pulse" />
                <div className="h-3 w-12 rounded-full bg-muted animate-pulse" />
              </div>
              <div className="h-3 w-full rounded bg-muted animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const DISMISSED_KEY = "watchlog.dismissedRecs";
const LAST_REFRESH_KEY = "watchlog.lastRecommendRefresh";

function canRefreshToday(): boolean {
  const last = localStorage.getItem(LAST_REFRESH_KEY);
  if (!last) return true;
  const lastDate = new Date(last).toDateString();
  return lastDate !== new Date().toDateString();
}

function markRefreshed() {
  localStorage.setItem(LAST_REFRESH_KEY, new Date().toISOString());
}

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
}

function FutureTimelineSection({
  items,
  loading,
  error,
  onRefresh,
  t,
}: {
  items: RecommendationItem[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [canRefresh, setCanRefresh] = useState(true);

  useEffect(() => {
    setDismissed(getDismissed());
    setCanRefresh(canRefreshToday());
  }, []);

  function dismiss(name: string) {
    const next = new Set(dismissed);
    next.add(name.toLowerCase());
    setDismissed(next);
    saveDismissed(next);
  }

  function handleRefresh() {
    if (!canRefresh) return;
    localStorage.removeItem(DISMISSED_KEY);
    setDismissed(new Set());
    markRefreshed();
    setCanRefresh(false);
    onRefresh();
  }

  const typeLabel = (type: string) => {
    if (type === "movie") return t("typeMovie");
    if (type === "series") return t("typeSeries");
    return t("typeBook");
  };

  const visible = items.filter((item) => !dismissed.has(item.name.toLowerCase()));

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading || !canRefresh}
        title={!canRefresh ? t("refreshCooldown") : undefined}
        className={cn(
          "rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted",
          (loading || !canRefresh) && "opacity-40 cursor-not-allowed",
        )}
      >
        {!canRefresh ? t("refreshCooldown") : t("refreshButton")}
      </button>

      {loading && <FutureLoadingSkeleton t={t} />}

      {!loading && error && (
        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-destructive shadow-sm">
          {t("futureError")}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          {t("futureNeedMoreLogs")}
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {visible.map((item, i) => (
            <div
              key={i}
              className="rounded-2xl border border-dashed border-primary/30 bg-card p-5 shadow-sm flex gap-5"
            >
              <div className="h-32 w-20 shrink-0 overflow-hidden rounded-xl bg-muted shadow-sm border border-border">
                {item.posterUrl ? (
                  <Image
                    src={item.posterUrl}
                    alt={item.name}
                    width={80}
                    height={128}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                    {typeLabel(item.type)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <span className="font-semibold text-sm leading-snug">
                    {item.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => dismiss(item.name)}
                    className="shrink-0 flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                    {t("dismissButton")}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs text-primary font-medium">
                    {typeLabel(item.type)}
                  </span>
                  {item.genres.map((g) => (
                    <span
                      key={g}
                      className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {g}
                    </span>
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
                  {item.reason}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

  const [mounted, setMounted] = useState(false);
  const [futureMode, setFutureMode] = useState(false);
  const [futureItems, setFutureItems] = useState<RecommendationItem[]>([]);
  const [futureLoading, setFutureLoading] = useState(false);
  const [futureError, setFutureError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

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

  async function loadFuture(refresh = false) {
    if (!getUserId()) return;
    setFutureLoading(true);
    setFutureError(null);
    try {
      const params = new URLSearchParams();
      if (refresh) params.set("refresh", "true");
      const dismissed = getDismissed();
      dismissed.forEach((name) => params.append("excluded", name));
      const url = `/recommendations${params.toString() ? `?${params}` : ""}`;
      const items = await apiWithAuth<RecommendationItem[]>(url);
      setFutureItems(items);
    } catch (e: any) {
      setFutureError(e?.message ?? "error");
    } finally {
      setFutureLoading(false);
    }
  }

  function enterFutureMode() {
    setFutureMode(true);
    if (futureItems.length === 0 && !futureLoading) {
      loadFuture(false);
    }
  }

  const headerTitle = futureMode
    ? tTimeline("futureTitle")
    : tTimeline("titleModern");

  const headerSubtitle = useMemo(() => {
    if (futureMode) return null;
    if (loading) return tTimeline("loading");
    if (err) return err;
    return tTimeline("subtitleModern");
  }, [futureMode, loading, err, tTimeline]);

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
            {futureMode ? (
              <Sparkles className="h-5 w-5 text-primary" />
            ) : (
              <Clock className="h-5 w-5" />
            )}
            {headerTitle}
          </div>
          <div className="flex items-center gap-2">
            {mounted && getUserId() && !futureMode && (
              <button
                type="button"
                onClick={enterFutureMode}
                style={{ background: "linear-gradient(to right, #7c3aed, #4f46e5)" }}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  {tTimeline("futureButton")}
                </span>
              </button>
            )}
            {!futureMode && (
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
            )}
            {futureMode && (
              <button
                type="button"
                onClick={() => setFutureMode(false)}
                className="rounded-lg border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                {tTimeline("backButton")}
              </button>
            )}
          </div>
        </div>
        {headerSubtitle && (
          <div className="text-sm text-muted-foreground">
            {headerSubtitle}
          </div>
        )}
        {exportStatus ? (
          <div className="text-sm text-muted-foreground">
            {exportStatus}
          </div>
        ) : null}
      </div>

      {futureMode ? (
        <FutureTimelineSection
          items={futureItems}
          loading={futureLoading}
          error={futureError}
          onRefresh={() => loadFuture(true)}
          t={tTimeline}
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
