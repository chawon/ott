"use client";

import {
  ChevronDown,
  Download,
  Settings,
  Smartphone,
  UserRound,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import ProfileEditor from "@/components/ProfileEditor";
import { Link as IntlLink } from "@/i18n/routing";
import {
  readAndroidAppContext,
  recordAndroidAppContextFromCurrentUrl,
} from "@/lib/androidAppContext";
import { api } from "@/lib/api";
import { pairWithCode } from "@/lib/auth";
import { downloadTimelineCsv } from "@/lib/export";
import {
  getDeviceId,
  getPairingCode,
  getUserId,
  listAllLogsLocal,
  resetLocalState,
} from "@/lib/localStore";
import { createPairingRecoveryCardBlob } from "@/lib/recoveryCard";
import { downloadBlob } from "@/lib/share";
import type { WatchLog } from "@/lib/types";
import { useUserProfile } from "@/lib/useUserProfile";
import { cn } from "@/lib/utils";

type DeviceSummary = {
  id: string;
  browser?: string | null;
  os?: string | null;
  createdAt: string;
  lastSeenAt: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const ANDROID_TWA_SESSION_KEY = "ottline.androidTwaSession";
const SETTINGS_CARD_CLASS =
  "space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm";

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1 px-1">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SettingsAccordionCard({
  title,
  description,
  meta,
  icon,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description: string;
  meta?: string;
  icon?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <section className={SETTINGS_CARD_CLASS}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <div className="shrink-0 rounded-2xl bg-ott-paper-strong p-2 text-[#1E4D8C] dark:text-foreground">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 space-y-1">
            <div className="text-base font-semibold">{title}</div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meta ? (
            <span className="rounded-full border border-border bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
              {meta}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "mt-1 h-5 w-5 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </button>
      {open ? (
        <div className="border-t border-border pt-4">{children}</div>
      ) : null}
    </section>
  );
}

function isGooglePlayTwaContext() {
  if (typeof window === "undefined") return false;
  const ref = document.referrer.toLowerCase();
  const fromOttlineTwa = ref.startsWith("android-app://app.ottline");
  const androidAppContext =
    recordAndroidAppContextFromCurrentUrl() ?? readAndroidAppContext();
  const fromVersionedAndroidApp = Boolean(
    androidAppContext?.versionName || androidAppContext?.versionCode,
  );
  const ua = window.navigator.userAgent.toLowerCase();
  const fromAndroidStandalone =
    ua.includes("android") &&
    window.matchMedia?.("(display-mode: standalone)").matches;

  try {
    if (fromOttlineTwa || fromVersionedAndroidApp || fromAndroidStandalone) {
      sessionStorage.setItem(ANDROID_TWA_SESSION_KEY, "1");
      return true;
    }

    return sessionStorage.getItem(ANDROID_TWA_SESSION_KEY) === "1";
  } catch {
    return fromOttlineTwa || fromVersionedAndroidApp || fromAndroidStandalone;
  }
}

export default function AccountPage() {
  const tAccount = useTranslations("Account");
  const tCsv = useTranslations("CSV");
  const tStatus = useTranslations("Status");
  const tCommon = useTranslations("Common");
  const tQuick = useTranslations("QuickLogCard");
  const locale = useLocale();
  const [userId, setUserId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [logs, setLogs] = useState<WatchLog[]>([]);
  const [exportRange, setExportRange] = useState<"ALL" | "video" | "book">(
    "ALL",
  );
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [recoveryCardSaving, setRecoveryCardSaving] = useState(false);
  const [recoveryCardStatus, setRecoveryCardStatus] = useState<string | null>(
    null,
  );
  const [showAndroidAppSection, setShowAndroidAppSection] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const { profile } = useUserProfile();

  const loadDevices = useCallback(async () => {
    if (!getUserId()) return;
    try {
      const res = await api<DeviceSummary[]>("/auth/devices");
      setDevices(res);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setUserId(getUserId());
    setDeviceId(getDeviceId());
    setPairingCode(getPairingCode());
    setShowAndroidAppSection(isGooglePlayTwaContext());
    setInitializing(false);
    loadDevices();
    listAllLogsLocal().then(setLogs);
  }, [loadDevices]);

  async function handlePair() {
    if (!input.trim() || loading) return;
    setLoading(true);
    setStatus(null);
    try {
      await pairWithCode(input.trim());
      setUserId(getUserId());
      setDeviceId(getDeviceId());
      setPairingCode(getPairingCode());
      setStatus(tAccount("statusConnected"));
      await loadDevices();
    } catch (error) {
      setStatus(getErrorMessage(error, tAccount("statusConnectFailed")));
    } finally {
      setLoading(false);
    }
  }

  async function revokeDevice(id: string) {
    if (loading) return;
    setLoading(true);
    try {
      await api(`/auth/devices/${id}`, { method: "DELETE" });
      if (id === getDeviceId()) {
        resetLocalState();
        setStatus(tAccount("statusResetAll"));
        window.location.reload();
      } else {
        setStatus(tAccount("statusUnlinked"));
        await loadDevices();
      }
    } catch (error) {
      setStatus(getErrorMessage(error, tAccount("statusUnlinkFailed")));
    } finally {
      setLoading(false);
    }
  }

  async function revokeAll() {
    if (loading) return;
    setLoading(true);
    try {
      await api("/auth/devices/all", { method: "DELETE" });
      await resetLocalState();
      setStatus(tAccount("statusResetAll"));
      window.location.reload();
    } catch (error) {
      setStatus(getErrorMessage(error, tAccount("statusResetFailed")));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetLocal() {
    if (!confirm(tAccount("resetConfirm"))) return;
    await resetLocalState();
    setStatus(tAccount("statusLocalReset"));
    window.location.reload();
  }

  async function deleteAccount() {
    if (loading || !userId) return;
    if (!confirm(tAccount("deleteAccountConfirm"))) return;
    setLoading(true);
    setStatus(null);
    try {
      await api("/auth/account", { method: "DELETE" });
      await resetLocalState();
      setStatus(tAccount("statusAccountDeleted"));
      window.location.reload();
    } catch (error) {
      setStatus(getErrorMessage(error, tAccount("statusAccountDeleteFailed")));
    } finally {
      setLoading(false);
    }
  }

  function exportFileName() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `watchlog-export-${y}${m}${d}.csv`;
  }

  function recoveryCardFileName() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `ottline-recovery-card-${y}${m}${d}.png`;
  }

  async function saveRecoveryCard() {
    if (!pairingCode || recoveryCardSaving) return;
    setRecoveryCardSaving(true);
    setRecoveryCardStatus(null);
    try {
      const blob = await createPairingRecoveryCardBlob(pairingCode, {
        eyebrow: tAccount("recoveryCardEyebrow"),
        title: tAccount("recoveryCardTitle"),
        subtitle: tAccount("recoveryCardSubtitle"),
        codeLabel: tAccount("recoveryCardCodeLabel"),
        instructionTitle: tAccount("recoveryCardInstructionTitle"),
        instructionBody: tAccount("recoveryCardInstructionBody"),
        warningTitle: tAccount("recoveryCardWarningTitle"),
        warningBody: tAccount("recoveryCardWarningBody"),
        footer: tAccount("recoveryCardFooter"),
      });
      await downloadBlob(blob, recoveryCardFileName());
      setRecoveryCardStatus(tAccount("statusRecoveryCardSaved"));
    } catch (error) {
      setRecoveryCardStatus(
        getErrorMessage(error, tAccount("statusRecoveryCardFailed")),
      );
    } finally {
      setRecoveryCardSaving(false);
    }
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
    } catch (error) {
      setExportStatus(getErrorMessage(error, tAccount("statusExportFailed")));
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

  const headerTitle = tAccount("titleModern");

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Settings className="h-6 w-6" />
          {headerTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {tAccount("descriptionModern")}
        </p>
      </header>

      <SettingsGroup
        title={tAccount("groupPersonalTitle")}
        description={tAccount("groupPersonalDesc")}
      >
        <SettingsAccordionCard
          title={tAccount("profileTitle")}
          description={tAccount("profileDesc")}
          icon={<UserRound className="h-5 w-5" />}
          open={profileOpen}
          onOpenChange={setProfileOpen}
        >
          {userId ? (
            <ProfileEditor profile={profile} />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              {tAccount("profileUnavailable")}
            </div>
          )}
        </SettingsAccordionCard>
      </SettingsGroup>

      <SettingsGroup
        title={tAccount("groupConnectionTitle")}
        description={tAccount("groupConnectionDesc")}
      >
        <section className={SETTINGS_CARD_CLASS}>
          <div className="space-y-1">
            <div className="text-sm font-semibold">
              {tAccount("pairingCodeLabel")}
            </div>
            <div
              className={cn(
                "flex h-12 items-center justify-center text-xl font-bold tracking-widest",
                "rounded-xl bg-muted/50",
              )}
            >
              {initializing
                ? tAccount("pairingCodeLoading")
                : (pairingCode ?? "—")}
            </div>
            <p className="text-xs text-muted-foreground">
              {logs.length > 0
                ? tAccount("pairingCodeDescModern")
                : tAccount("pairingCodeDescEmpty")}
            </p>
            {!pairingCode && !initializing && (
              <p className="mt-2 rounded-lg border border-[#1E4D8C]/20 bg-ott-paper-strong p-2 text-[11px] font-medium text-[#1E4D8C] dark:border-border dark:text-foreground">
                {tAccount("pairingCodeNotice")}
              </p>
            )}
            {pairingCode && !initializing ? (
              <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                <p className="text-xs text-amber-900 dark:text-amber-100">
                  {tAccount("recoveryCardHelp")}
                </p>
                <button
                  type="button"
                  onClick={saveRecoveryCard}
                  disabled={recoveryCardSaving}
                  className={cn(
                    "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-all sm:w-auto",
                    "bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-40",
                  )}
                >
                  <Download className="h-4 w-4" />
                  {recoveryCardSaving
                    ? tAccount("recoveryCardSaving")
                    : tAccount("recoveryCardAction")}
                </button>
                {recoveryCardStatus ? (
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
                    {recoveryCardStatus}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-3 pt-2">
            <div className="text-sm font-semibold">
              {tAccount("connectDevice")}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                placeholder={tAccount("pairingCodePlaceholder")}
                className={cn(
                  "min-h-12 flex-1 px-3 text-sm outline-none",
                  "rounded-xl border border-border bg-card focus:ring-2 focus:ring-ring/40",
                )}
              />
              <button
                type="button"
                onClick={handlePair}
                disabled={loading || !input.trim()}
                className={cn(
                  "min-h-[52px] px-5 text-sm font-bold transition-all",
                  "rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40",
                )}
              >
                {loading ? tAccount("connecting") : tAccount("connectAction")}
              </button>
            </div>
            {status && (
              <div className="text-xs font-medium text-[#1E4D8C] dark:text-foreground">
                {status}
              </div>
            )}
          </div>
        </section>

        <SettingsAccordionCard
          title={tAccount("connectedDevices")}
          description={tAccount("connectedDevicesDesc")}
          meta={tAccount("connectedDevicesCount", { count: devices.length })}
          open={devicesOpen}
          onOpenChange={setDevicesOpen}
        >
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
                      "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                      isCurrent
                        ? "border-[#1E4D8C]/25 bg-ott-paper-strong dark:border-border"
                        : "border-border",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                          {isCurrent
                            ? tAccount("currentDevice")
                            : tAccount("otherDevice")}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {d.browser ?? tAccount("browser")} ·{" "}
                          {d.os ?? tAccount("os")}
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
                        className="min-h-12 shrink-0 rounded-xl border border-red-200 px-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                      >
                        {tAccount("unlinkAction")}
                      </button>
                    ) : (
                      <div className="shrink-0 rounded-full border border-[#1E4D8C]/20 bg-card px-2 py-0.5 text-[10px] font-bold uppercase text-[#1E4D8C] dark:border-border dark:text-foreground">
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
                className="mt-2 min-h-[52px] w-full rounded-2xl border border-border bg-card text-xs font-bold text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
              >
                {tAccount("unlinkAllAction")}
              </button>
            )}
          </div>
        </SettingsAccordionCard>

        <section className={SETTINGS_CARD_CLASS}>
          <div className="text-sm font-semibold">
            {tAccount("accountInfoLabel")}
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>User ID</span>
              <span className="font-mono">{userId?.slice(0, 8) ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span>Device ID</span>
              <span className="font-mono">{deviceId?.slice(0, 8) ?? "—"}</span>
            </div>
            <p className="mt-2 opacity-70">{tAccount("accountInfoNotice")}</p>
          </div>
        </section>
      </SettingsGroup>

      <SettingsGroup
        title={tAccount("groupSupportTitle")}
        description={tAccount("groupSupportDesc")}
      >
        <section className={SETTINGS_CARD_CLASS}>
          <div>
            <div className="text-base font-semibold">
              {tAccount("feedbackTitle")}
            </div>
            <p className="text-sm text-muted-foreground">
              {tAccount("feedbackDesc")}
            </p>
          </div>
          <IntlLink
            href="/feedback"
            className={cn(
              "flex w-full items-center justify-center gap-2 px-4 py-3 text-center text-sm font-bold transition-all break-keep",
              "rounded-2xl border border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {tAccount("feedbackAction")}
          </IntlLink>
        </section>

        {showAndroidAppSection ? (
          <section className="space-y-4 rounded-2xl border border-[#1E4D8C]/20 bg-ott-paper-strong p-6 shadow-sm dark:border-border">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-card p-2 text-[#1E4D8C] shadow-sm dark:text-foreground">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="text-base font-semibold">
                  {tAccount("androidAppTitle")}
                </div>
                <p className="text-sm text-muted-foreground">
                  {tAccount("androidAppDesc")}
                </p>
              </div>
            </div>
            <a
              href="ottline://watch-reminder"
              className={cn(
                "flex w-full items-center justify-center gap-2 px-4 py-3 text-center text-sm font-bold transition-all break-keep",
                "rounded-2xl border border-[#1E4D8C]/25 bg-card text-[#1E4D8C] hover:bg-ott-paper-strong dark:border-border dark:text-foreground",
              )}
            >
              <Settings className="h-4 w-4" />
              {tAccount("androidWatchReminderAction")}
            </a>
            <p className="text-xs text-muted-foreground">
              {tAccount("androidWatchReminderDesc")}
            </p>
          </section>
        ) : null}
      </SettingsGroup>

      <SettingsGroup
        title={tAccount("groupDataTitle")}
        description={tAccount("groupDataDesc")}
      >
        <section className={SETTINGS_CARD_CLASS}>
          <div>
            <div className="text-base font-semibold">
              {tAccount("exportTitle")}
            </div>
            <p className="text-sm text-muted-foreground">
              {logs.length > 0
                ? tAccount("exportDescModern")
                : tAccount("exportDescEmpty")}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <div className="px-1 text-xs font-semibold text-muted-foreground">
                {tAccount("exportRangeLabel")}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["ALL", "video", "book"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setExportRange(r)}
                    className={cn(
                      "min-h-[52px] rounded-xl border px-2 text-xs font-medium transition-all",
                      exportRange === r
                        ? "border-[#1E4D8C]/40 bg-ott-paper-strong text-[#1E4D8C] shadow-sm ring-1 ring-[#1E4D8C]/15 dark:border-border dark:text-foreground dark:ring-border"
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
                "min-h-[52px] w-full rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-all hover:bg-neutral-800 disabled:opacity-40",
              )}
            >
              {exporting ? tAccount("exporting") : tAccount("exportAction")}
            </button>
            {exportStatus && (
              <p className="text-center text-xs font-medium text-[#1E4D8C] dark:text-foreground">
                {exportStatus}
              </p>
            )}
            <p className="text-center text-[11px] text-muted-foreground">
              {tAccount("exportNotice")}
            </p>
          </div>
        </section>

        <section className={SETTINGS_CARD_CLASS}>
          <div>
            <div className="text-sm font-semibold">
              {tAccount("resetLocalTitle")}
            </div>
            <p className="text-xs text-muted-foreground">
              {tAccount("resetLocalDesc")}
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetLocal}
            className={cn(
              "min-h-[52px] w-full rounded-2xl border border-red-200 bg-red-50 text-sm font-bold text-red-600 transition-all hover:bg-red-100",
            )}
          >
            {tAccount("resetLocalAction")}
          </button>
        </section>

        <section className="space-y-4 rounded-2xl border border-red-200 bg-red-50/60 p-6 shadow-sm">
          <div>
            <div className="text-sm font-semibold text-red-700">
              {tAccount("deleteAccountTitle")}
            </div>
            <p className="text-xs text-red-700/80">
              {tAccount("deleteAccountDesc")}
            </p>
          </div>
          <button
            type="button"
            onClick={deleteAccount}
            disabled={loading || !userId}
            className={cn(
              "min-h-[52px] w-full rounded-2xl border border-red-300 bg-red-600 text-sm font-bold text-white transition-all hover:bg-red-700 disabled:opacity-40",
            )}
          >
            {tAccount("deleteAccountAction")}
          </button>
        </section>
      </SettingsGroup>
    </div>
  );
}
