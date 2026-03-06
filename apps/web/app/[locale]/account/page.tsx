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

import { useTranslations } from "next-intl";
export default function AccountPage() {
  const tAccount = useTranslations("Account");
  const { isRetro } = useRetro();
  const [userId, setUserId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportContentType, setExportContentType] = useState<
    "ALL" | "video" | "book"
  >("ALL");
  const [initializing, setInitializing] = useState(false);
  const [devices, setDevices] = useState<
    {
      id: string;
      createdAt: string;
      lastSeenAt: string;
      os?: string | null;
      browser?: string | null;
    }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInitializing(true);
      setStatus(null);
      try {
        const storedUserId = getUserId();
        const storedDeviceId = getDeviceId();
        const storedPairingCode = getPairingCode();
        if (cancelled) return;

        setUserId(storedUserId);
        setDeviceId(storedDeviceId);
        setPairingCode(storedPairingCode);

        if (storedUserId) {
          await loadDevices();
        } else {
          setDevices([]);
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function pair() {
    if (!input.trim()) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await pairWithCode(input.trim());
      setUserId(res.userId);
      setDeviceId(res.deviceId);
      setPairingCode(res.pairingCode);
      setInput("");
      setStatus(tAccount("statusConnected"));
      await loadDevices();
    } catch (e: any) {
      setStatus(e?.message ?? tAccount("statusConnectFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function loadDevices() {
    if (!getUserId()) {
      setDevices([]);
      return [];
    }
    try {
      const res =
        await api<
          {
            id: string;
            createdAt: string;
            lastSeenAt: string;
            os?: string | null;
            browser?: string | null;
          }[]
        >("/auth/devices");
      setDevices(res);
      return res;
    } catch {
      setDevices([]);
      return [];
    }
  }

  async function resetIdentity() {
    await resetLocalState();
    setUserId(null);
    setDeviceId(null);
    setPairingCode(null);
    setDevices([]);
  }

  async function revokeDevice(targetId: string) {
    setLoading(true);
    setStatus(null);
    try {
      await api(`/auth/devices/${targetId}`, { method: "DELETE" });
      const next = await loadDevices();
      if (next.length === 0) {
        await resetIdentity();
        setStatus(tAccount("statusResetAll"));
        return;
      }
      setStatus(tAccount("statusUnlinked"));
    } catch (e: any) {
      setStatus(e?.message ?? tAccount("statusUnlinkFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function revokeAllDevices() {
    if (devices.length === 0) return;
    setLoading(true);
    setStatus(null);
    try {
      for (const d of devices) {
        await api(`/auth/devices/${d.id}`, { method: "DELETE" });
      }
      await resetIdentity();
      setStatus(tAccount("statusResetAll"));
    } catch (e: any) {
      setStatus(e?.message ?? tAccount("statusResetFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function resetLocalOnly() {
    const ok = confirm(tAccount("resetConfirm"));
    if (!ok) return;
    setLoading(true);
    setStatus(null);
    try {
      await resetLocalState();
      setStatus(tAccount("statusLocalReset"));
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }

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
    if (!hasAccount) {
      setExportStatus(tAccount("statusNoExportData"));
      return;
    }
    setExporting(true);
    setExportStatus(null);
    try {
      const logs = await listAllLogsLocal();
      const filtered =
        exportContentType === "book"
          ? logs.filter((log) => log.title?.type === "book")
          : exportContentType === "video"
            ? logs.filter((log) => log.title?.type !== "book")
            : logs;
      if (filtered.length === 0) {
        setExportStatus(tAccount("statusNoMatchingLogs"));
        return;
      }
      downloadTimelineCsv(filtered, exportFileName());
      setExportStatus(tAccount("statusExportSuccess"));
    } catch (e: any) {
      setExportStatus(e?.message ?? tAccount("statusExportFailed"));
    } finally {
      setExporting(false);
    }
  }

  function formatShort(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  }

  const headerTitle = isRetro
    ? tAccount("titleRetro")
    : tAccount("titleModern");
  const hasAccount = !!userId;
  const headerSubtitle = isRetro
    ? tAccount("descriptionRetro")
    : tAccount("descriptionModern");

  return (
    <div className="space-y-4">
      <div>
        {isRetro ? (
          <div className="flex items-baseline justify-between border-b-4 border-black pb-2 mb-4">
            <div className="text-xl font-bold uppercase tracking-tighter">
              {headerTitle}
            </div>
          </div>
        ) : (
          <div className="text-xl font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {headerTitle}
          </div>
        )}
        <div
          className={cn(
            isRetro
              ? "text-xs font-bold text-neutral-500 uppercase"
              : "text-sm text-muted-foreground",
          )}
        >
          {headerSubtitle}
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-2">
        <div className="text-sm font-semibold">{tAccount("sectionReport")}</div>
        <div className="text-xs text-muted-foreground">
          {hasAccount
            ? tAccount("reportDescModern")
            : tAccount("reportDescEmpty")}
        </div>
        {hasAccount ? (
          <Link
            href="/me/report"
            className="inline-flex rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            내 이용 리포트 보기
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted-foreground opacity-60"
          >
            내 이용 리포트 보기
          </button>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-2">
        <div className="text-sm text-muted-foreground">
          {tAccount("pairingCodeLabel")}
        </div>
        <div className="text-2xl font-semibold tracking-widest">
          {initializing ? tAccount("pairingCodeLoading") : (pairingCode ?? "—")}
        </div>
        <div className="text-xs text-muted-foreground">
          {pairingCode
            ? tAccount("pairingCodeDescModern")
            : tAccount("pairingCodeDescEmpty")}
        </div>
        {!pairingCode ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {tAccount("pairingCodeNotice")}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
        <div className="text-sm font-semibold">{tAccount("connectDevice")}</div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tAccount("pairingCodePlaceholder")}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
        />
        <button
          type="button"
          onClick={pair}
          disabled={loading || !input.trim()}
          className="w-full rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-40"
        >
          {loading ? tAccount("connecting") : tAccount("connectAction")}
        </button>
        {status ? (
          <div className="text-sm text-muted-foreground">{status}</div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-2">
        <div className="text-sm text-muted-foreground">
          {tAccount("accountInfoLabel")}
        </div>
        <div className="text-xs text-muted-foreground">
          User: {userId ?? "—"}
        </div>
        <div className="text-xs text-muted-foreground">
          Device: {deviceId ?? "—"}
        </div>
        {!userId ? (
          <div className="text-xs text-muted-foreground">
            {tAccount("accountInfoNotice")}
          </div>
        ) : null}
      </section>

      <section
        className={cn(
          "rounded-2xl p-6 shadow-sm space-y-3",
          isRetro
            ? "border-4 border-black bg-white"
            : "border border-border bg-card",
        )}
      >
        <div className="text-sm font-semibold">
          {tAccount("resetLocalTitle")}
        </div>
        <div className="text-xs text-muted-foreground">
          {tAccount("resetLocalDesc")}
        </div>
        <button
          type="button"
          onClick={resetLocalOnly}
          disabled={loading}
          className={cn(
            "w-full px-4 py-3 text-sm font-semibold",
            isRetro
              ? "border-2 border-black bg-white text-black hover:bg-yellow-200"
              : "rounded-2xl border border-border bg-card text-muted-foreground hover:bg-muted",
            loading && "opacity-40",
          )}
        >
          로컬 초기화
        </button>
      </section>

      <section
        className={cn(
          "rounded-2xl p-6 shadow-sm space-y-3",
          isRetro
            ? "border-4 border-black bg-white"
            : "border border-border bg-card",
        )}
      >
        <div className="text-sm font-semibold">{tAccount("exportTitle")}</div>
        <div className="text-xs text-muted-foreground">
          {hasAccount
            ? tAccount("exportDescModern")
            : tAccount("exportDescEmpty")}
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            내보내기 범위
          </div>
          <select
            value={exportContentType}
            onChange={(e) =>
              setExportContentType(e.target.value as "ALL" | "video" | "book")
            }
            disabled={!hasAccount}
            className={cn(
              "w-full select-base rounded-xl px-3 py-2 text-sm",
              isRetro && "border-2 border-black bg-white text-black",
              !hasAccount && "opacity-60",
            )}
          >
            <option value="ALL">{tAccount("rangeAll")}</option>
            <option value="video">{tAccount("rangeVideo")}</option>
            <option value="book">{tAccount("rangeBook")}</option>
          </select>
        </div>
        <button
          type="button"
          onClick={exportTimelineCsv}
          disabled={exporting || !hasAccount}
          className={cn(
            "w-full px-4 py-3 text-sm font-semibold",
            isRetro
              ? "border-2 border-black bg-white text-black hover:bg-yellow-200"
              : "rounded-2xl bg-foreground text-background",
            (exporting || !hasAccount) && "opacity-40",
          )}
        >
          {exporting ? tAccount("exporting") : tAccount("exportAction")}
        </button>
        <div className="text-xs text-muted-foreground">
          {tAccount("exportNotice")}
        </div>
        {exportStatus ? (
          <div className="text-sm text-muted-foreground">{exportStatus}</div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
        <div className="text-sm font-semibold">
          {tAccount("connectedDevices")}
        </div>
        {devices.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            연결된 기기가 없어요.
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((d) => {
              const isCurrent = d.id === deviceId;
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card/80 px-3 py-2 text-card-foreground"
                >
                  <div>
                    <div className="text-sm text-foreground">
                      {isCurrent
                        ? tAccount("currentDevice")
                        : tAccount("otherDevice")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.browser ?? tAccount("browser")} ·{" "}
                      {d.os ?? tAccount("os")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tAccount("createdAt", {
                        date: formatShort(d.createdAt),
                      })}{" "}
                      ·{" "}
                      {tAccount("lastActiveAt", {
                        date: formatShort(d.lastSeenAt),
                      })}
                    </div>
                  </div>
                  {!isCurrent ? (
                    <button
                      type="button"
                      onClick={() => revokeDevice(d.id)}
                      disabled={loading}
                      className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
                    >
                      연결 해제
                    </button>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100">
                      현재
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {devices.length > 0 ? (
          <button
            type="button"
            onClick={revokeAllDevices}
            disabled={loading}
            className="mt-2 w-full rounded-2xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-40"
          >
            모든 기기 해제하고 초기화
          </button>
        ) : null}
      </section>
    </div>
  );
}
