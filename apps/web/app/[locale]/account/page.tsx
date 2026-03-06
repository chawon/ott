"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { pairWithCode } from "@/lib/auth";
import {
  getDeviceId,
  getPairingCode,
  getUserId,
  listAllLogsLocal,
  resetLocalState,
} from "@/lib/localStore";
import { api } from "@/lib/api";
import { useRetro } from "@/context/RetroContext";
import { cn } from "@/lib/utils";
import { downloadTimelineCsv } from "@/lib/export";

import { useLocale, useTranslations } from "next-intl";
export default function AccountPage() {
  const tAccount = useTranslations("Account");
  const tCsv = useTranslations("CSV");
  const tStatus = useTranslations("Status");
  const tCommon = useTranslations("Common");
  const tQuick = useTranslations("QuickLogCard");
  const { isRetro } = useRetro();
  const locale = useLocale();
  const [userId, setUserId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [devices, setDevices] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [exportRange, setExportRange] = useState<"ALL" | "video" | "book">(
    "ALL",
  );
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  useEffect(() => {
    setUserId(getUserId());
    setDeviceId(getDeviceId());
    setPairingCode(getPairingCode());
    setInitializing(false);
    loadDevices();
    listAllLogsLocal().then(setLogs);
  }, []);

  async function loadDevices() {
    if (!getUserId()) return;
    try {
      const res = await api<any[]>("/devices");
      setDevices(res);
    } catch {
      // ignore
    }
  }

  async function handlePair() {
    if (!input.trim() || loading) return;
    setLoading(true);
    setStatus(null);
    try {
      await pairWithCode(input.trim());
      setStatus(tAccount("statusConnected"));
      await loadDevices();
    } catch (e: any) {
      setStatus(e?.message ?? tAccount("statusConnectFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function revokeDevice(id: string) {
    if (loading) return;
    setLoading(true);
    try {
      await api(`/devices/${id}`, { method: "DELETE" });
      if (id === getDeviceId()) {
        resetLocalState();
        setStatus(tAccount("statusResetAll"));
        window.location.reload();
      } else {
        setStatus(tAccount("statusUnlinked"));
        await loadDevices();
      }
    } catch (e: any) {
      setStatus(e?.message ?? tAccount("statusUnlinkFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function revokeAll() {
    if (loading) return;
    setLoading(true);
    try {
      await api("/devices/all", { method: "DELETE" });
      resetLocalState();
      setStatus(tAccount("statusResetAll"));
      window.location.reload();
    } catch (e: any) {
      setStatus(e?.message ?? tAccount("statusResetFailed"));
    } finally {
      setLoading(false);
    }
  }

  function handleResetLocal() {
    if (confirm(tAccount("resetConfirm"))) {
      resetLocalState();
      setStatus(tAccount("statusLocalReset"));
      window.location.reload();
    }
  }

  function exportFileName() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `watchlog-export-${y}${m}${d}.csv`;
  }

  async function exportLogs() {
    setExporting(true);
    setExportStatus(null);
    try {
      const filtered =
        exportRange === "video"
          ? logs.filter((l) => l.title.type !== "book")
          : exportRange === "book"
            ? logs.filter((l) => l.title.type === "book")
            : logs;
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

  function formatShort(iso: string, locale: string) {
    const d = new Date(iso);
    return d.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric",
    });
  }

  const headerTitle = isRetro
    ? tAccount("titleRetro")
    : tAccount("titleModern");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" />
          {headerTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isRetro
            ? tAccount("descriptionRetro")
            : tAccount("descriptionModern")}
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold">
            {tAccount("sectionReport")}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {logs.length > 0
            ? tAccount("reportDescModern")
            : tAccount("reportDescEmpty")}
        </p>
        {logs.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Link
              href="/me/report"
              className={cn(
                "inline-flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all",
                isRetro
                  ? "border-4 border-black bg-[#2ecc71] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  : "rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20",
              )}
            >
              {tAccount("viewReport")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2 opacity-50 pointer-events-none">
            <div
              className={cn(
                "inline-flex items-center justify-center gap-2 py-3 text-sm font-bold",
                isRetro
                  ? "border-4 border-black bg-neutral-200 text-neutral-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  : "rounded-2xl bg-neutral-100 text-neutral-400",
              )}
            >
              {tAccount("viewReport")}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <div className="text-sm font-semibold">
            {tAccount("pairingCodeLabel")}
          </div>
          <div
            className={cn(
              "flex h-12 items-center justify-center text-xl font-bold tracking-widest",
              isRetro
                ? "border-4 border-black bg-white"
                : "rounded-xl bg-muted/50",
            )}
          >
            {initializing ? tAccount("pairingCodeLoading") : (pairingCode ?? "—")}
          </div>
          <p className="text-xs text-muted-foreground">
            {logs.length > 0
              ? tAccount("pairingCodeDescModern")
              : tAccount("pairingCodeDescEmpty")}
          </p>
          {!pairingCode && !initializing && (
            <p className="mt-2 text-[11px] font-medium text-indigo-600 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
              {tAccount("pairingCodeNotice")}
            </p>
          )}
        </div>

        <div className="space-y-3 pt-2">
          <div className="text-sm font-semibold">
            {tAccount("connectDevice")}
          </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              placeholder={tAccount("pairingCodePlaceholder")}
              className={cn(
                "flex-1 px-3 py-2 text-sm outline-none",
                isRetro
                  ? "border-4 border-black font-bold uppercase"
                  : "rounded-xl border border-border bg-card focus:ring-2 focus:ring-ring/40",
              )}
            />
            <button
              onClick={handlePair}
              disabled={loading || !input.trim()}
              className={cn(
                "px-4 py-2 text-sm font-bold transition-all",
                isRetro
                  ? "border-4 border-black bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-400"
                  : "rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40",
              )}
            >
              {loading ? tAccount("connecting") : tAccount("connectAction")}
            </button>
          </div>
          {status && (
            <div className="text-xs font-medium text-blue-600">{status}</div>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="text-sm font-semibold">{tAccount("accountInfoLabel")}</div>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>User ID</span>
            <span className="font-mono">{userId?.slice(0, 8) ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span>Device ID</span>
            <span className="font-mono">{deviceId?.slice(0, 8) ?? "—"}</span>
          </div>
          <p className="mt-2 opacity-70">
            {tAccount("accountInfoNotice")}
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div>
          <div className="text-sm font-semibold">{tAccount("resetLocalTitle")}</div>
          <p className="text-xs text-muted-foreground">
            {tAccount("resetLocalDesc")}
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetLocal}
          className={cn(
            "w-full py-3 text-sm font-bold transition-all",
            isRetro
              ? "border-4 border-black bg-red-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              : "rounded-2xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
          )}
        >
          {tAccount("resetLocalAction")}
        </button>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div>
          <div className="text-base font-semibold">{tAccount("exportTitle")}</div>
          <p className="text-sm text-muted-foreground">
            {logs.length > 0
              ? tAccount("exportDescModern")
              : tAccount("exportDescEmpty")}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground px-1">
              {tAccount("exportRangeLabel")}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["ALL", "video", "book"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setExportRange(r)}
                  className={cn(
                    "rounded-xl border py-2 text-xs font-medium transition-all",
                    exportRange === r
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30"
                      : "border-border bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {r === "ALL"
                    ? tAccount("rangeAll")
                    : r === "video"
                      ? tAccount("rangeVideo")
                      : tAccount("rangeBook")}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={exportLogs}
            disabled={exporting || logs.length === 0}
            className={cn(
              "w-full rounded-2xl bg-neutral-900 py-3 text-sm font-semibold text-white transition-all hover:bg-neutral-800 disabled:opacity-40",
            )}
          >
            {exporting ? tAccount("exporting") : tAccount("exportAction")}
          </button>
          {exportStatus && (
            <p className="text-center text-xs font-medium text-blue-600">
              {exportStatus}
            </p>
          )}
          <p className="text-center text-[11px] text-muted-foreground">
            {tAccount("exportNotice")}
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="text-sm font-semibold">{tAccount("connectedDevices")}</div>
        <div className="space-y-3">
          {devices.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              {tAccount("noConnectedDevices")}
            </div>
          ) : (
            devices.map((d) => {
              const isCurrent = d.id === getDeviceId();
              return (
                <div
                  key={d.id}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-3",
                    isCurrent
                      ? "border-indigo-200 bg-indigo-50/30 dark:bg-indigo-950/10"
                      : "border-border",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {isCurrent ? tAccount("currentDevice") : tAccount("otherDevice")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {d.browser ?? tAccount("browser")} · {d.os ?? tAccount("os")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tAccount("createdAt", {
                        date: formatShort(d.createdAt, locale),
                      })}{" "}
                      ·{" "}
                      {tAccount("lastActiveAt", {
                        date: formatShort(d.lastSeenAt, locale),
                      })}
                    </div>
                  </div>
                  {!isCurrent ? (
                    <button
                      type="button"
                      onClick={() => revokeDevice(d.id)}
                      disabled={loading}
                      className={cn(
                        "shrink-0 text-xs font-bold transition-colors",
                        isRetro
                          ? "bg-red-600 text-white px-2 py-1 border-2 border-black"
                          : "text-red-600 hover:text-red-700",
                      )}
                    >
                      {tAccount("unlinkAction")}
                    </button>
                  ) : (
                    <div
                      className={cn(
                        "shrink-0 text-[10px] font-bold uppercase",
                        isRetro
                          ? "bg-black text-white px-2 py-1"
                          : "rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-600",
                      )}
                    >
                      {tAccount("currentLabel")}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {devices.length > 0 && (
            <button
              type="button"
              onClick={revokeAll}
              disabled={loading}
              className={cn(
                "mt-2 w-full py-3 text-xs font-bold transition-all",
                isRetro
                  ? "border-4 border-black bg-neutral-800 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-black"
                  : "rounded-2xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tAccount("unlinkAllAction")}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
