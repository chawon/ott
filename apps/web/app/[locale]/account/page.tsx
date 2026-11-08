"use client";

import {
  ArrowRight,
  ChevronDown,
  Copy,
  Download,
  Link2,
  Settings,
  Smartphone,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import styles from "@/components/AccountSpace.module.css";
import ProfileAvatar from "@/components/ProfileAvatar";
import ProfileEditor from "@/components/ProfileEditor";
import QuickLogAction from "@/components/QuickLogAction";
import { Link as IntlLink } from "@/i18n/routing";
import { isGooglePlayTwaContext } from "@/lib/androidAppContext";
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
import { isPersonaKey } from "@/lib/profile";
import { createPairingRecoveryCardBlob } from "@/lib/recoveryCard";
import { downloadBlob } from "@/lib/share";
import { getSyncState, syncOutbox } from "@/lib/sync";
import type { WatchLog } from "@/lib/types";
import { useUserProfile } from "@/lib/useUserProfile";

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

export default function AccountPage() {
  const tProfile = useTranslations("Profile");
  const tAccount = useTranslations("Account");
  const tCsv = useTranslations("CSV");
  const tStatus = useTranslations("Status");
  const tCommon = useTranslations("Common");
  const tQuick = useTranslations("QuickLogCard");
  const locale = useLocale();
  const ko = locale === "ko";
  const copy = (korean: string, english: string) => (ko ? korean : english);
  const [userId, setUserId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [devices, setDevices] = useState<DeviceSummary[] | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState(false);
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
  const { profile } = useUserProfile();

  const loadDevices = useCallback(async () => {
    if (!getUserId()) {
      setDevices(null);
      setDevicesError(false);
      return;
    }
    setDevicesLoading(true);
    setDevicesError(false);
    try {
      setDevices(await api<DeviceSummary[]>("/auth/devices"));
    } catch {
      setDevices(null);
      setDevicesError(true);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  useEffect(() => {
    function refreshAccount() {
      setUserId(getUserId());
      setDeviceId(getDeviceId());
      setPairingCode(getPairingCode());
      setShowAndroidAppSection(isGooglePlayTwaContext());
      setInitializing(false);
      void loadDevices();
      void listAllLogsLocal().then(setLogs);
    }
    refreshAccount();
    for (const event of ["auth:changed", "auth:revoked", "sync:updated"])
      window.addEventListener(event, refreshAccount);
    return () => {
      for (const event of ["auth:changed", "auth:revoked", "sync:updated"])
        window.removeEventListener(event, refreshAccount);
    };
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
      setInput("");
      let synced = false;
      try {
        // The connection is ready when the linked timeline is cached, too.
        await syncOutbox();
        synced = getSyncState().status === "idle";
      } catch {
        // Pairing succeeded; a failed pull must not undo the new connection.
      }
      setStatus(
        tAccount(synced ? "statusConnected" : "statusConnectedSyncPending"),
      );
      setLogs(await listAllLogsLocal());
      await loadDevices();
    } catch (error) {
      setStatus(getErrorMessage(error, tAccount("statusConnectFailed")));
    } finally {
      setLoading(false);
    }
  }

  async function revokeDevice(id: string) {
    if (loading) return;
    if (
      !confirm(
        copy(
          "이 기기의 연결을 해제할까요? 해제한 기기에서는 내 기록을 열 수 없어요.",
          "Disconnect this device? It will no longer be able to access your records.",
        ),
      )
    )
      return;
    setLoading(true);
    try {
      await api(`/auth/devices/${id}`, { method: "DELETE" });
      if (id === getDeviceId()) {
        await resetLocalState();
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
    if (
      !confirm(
        copy(
          "지금 사용하는 기기를 포함해 모든 기기를 연결 해제할까요? 다시 연결하려면 보관한 연결 코드가 필요해요.",
          "Disconnect every device, including this one? You will need your saved connection code to reconnect.",
        ),
      )
    )
      return;
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
    return `ottline-code-card-${y}${m}${d}.png`;
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

  const otherDevices = devices?.filter((device) => device.id !== deviceId);
  const hasPersona = isPersonaKey(profile?.personaKey);

  async function copyCode() {
    if (!pairingCode) return;
    try {
      await navigator.clipboard.writeText(pairingCode);
      setRecoveryCardStatus(
        copy(
          "연결 코드를 복사했어요. 나만 볼 수 있는 곳에 보관해 주세요.",
          "Code copied. Keep it somewhere private.",
        ),
      );
    } catch {
      setRecoveryCardStatus(
        copy(
          "복사하지 못했어요. 코드를 직접 선택하거나 보관 카드로 저장해 주세요.",
          "Could not copy. Select the code or save a recovery card.",
        ),
      );
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>{copy("나의 공간", "MY SPACE")}</p>
        <h1>{copy("어디서든, 나의 기록", "Your records, wherever you are")}</h1>
        <p>
          {copy(
            "계정을 외우는 대신, 내 기록을 이어가는 방법.",
            "A simple way to carry your records with you.",
          )}
        </p>
      </header>
      <section
        className={styles.panel}
        aria-label={copy("나의 프로필", "My profile")}
      >
        <div className={styles.profile}>
          <ProfileAvatar personaKey={profile?.personaKey} size={80} />
          <div className={styles.profileCopy}>
            <p className={styles.eyebrow}>
              {copy("나의 프로필", "My profile")}
            </p>
            <h2>
              {profile?.nickname ||
                copy(
                  "나의 타임라인에, 나다운 모습",
                  "A familiar face for your timeline",
                )}
            </h2>
            <p>
              {hasPersona
                ? profile?.personaKey === "archive_collector" && !ko
                  ? "Timeline keeper"
                  : tProfile(`personas.${profile?.personaKey}`)
                : copy(
                    "닉네임과 아바타로 내 공간을 꾸며보세요.",
                    "Make this space yours with a nickname and avatar.",
                  )}
            </p>
            <p className={styles.privacy}>
              {copy(
                "닉네임과 아바타는 내 화면에서만 보여요.",
                "Your nickname and avatar appear only on your own screens.",
              )}
            </p>
          </div>
          {userId && (
            <button
              type="button"
              className={styles.button}
              onClick={() => setProfileOpen(!profileOpen)}
              aria-expanded={profileOpen}
              aria-controls="my-profile-editor"
            >
              {profileOpen
                ? copy("닫기", "Close")
                : copy("내 모습 고르기", "Choose my look")}
            </button>
          )}
        </div>
        {profileOpen && userId && (
          <div id="my-profile-editor" className={styles.profileEditor}>
            <ProfileEditor
              profile={profile}
              onDismiss={() => setProfileOpen(false)}
            />
          </div>
        )}
        {!userId && !initializing && (
          <p>
            {copy(
              "첫 기록을 남기거나 기존 기록을 연결한 뒤 내 모습을 고를 수 있어요.",
              "Leave your first record or connect your existing records to choose your profile.",
            )}
          </p>
        )}
      </section>
      {status && (
        <p aria-live="polite" className={styles.status}>
          {status}
        </p>
      )}
      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <Link2 aria-hidden="true" size={24} />
            <h2>{copy("내 기록 이어보기", "Keep your records with you")}</h2>
          </div>
          {initializing ? (
            <p aria-live="polite">{tAccount("pairingCodeLoading")}</p>
          ) : pairingCode ? (
            <>
              <p>
                {copy(
                  "다른 기기의 내 공간에서 이 코드를 입력하면 같은 기록을 열 수 있어요.",
                  "Enter this code in My space on another device to open the same records.",
                )}
              </p>
              <code className={styles.code}>{pairingCode}</code>
              <p>
                {copy(
                  "이 코드를 아는 사람은 내 기록을 열 수 있어요. 나만 볼 수 있는 곳에 보관해 주세요.",
                  "Anyone with this code can open your records. Keep it somewhere private.",
                )}
              </p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.button}
                  onClick={copyCode}
                >
                  <Copy aria-hidden="true" size={17} />
                  {copy("코드 복사", "Copy code")}
                </button>
                <button
                  type="button"
                  className={styles.button}
                  onClick={saveRecoveryCard}
                  disabled={recoveryCardSaving}
                >
                  <Download aria-hidden="true" size={17} />
                  {recoveryCardSaving
                    ? tAccount("recoveryCardSaving")
                    : tAccount("recoveryCardAction")}
                </button>
              </div>
              {recoveryCardStatus && (
                <p aria-live="polite">{recoveryCardStatus}</p>
              )}
              {otherDevices?.length === 0 &&
                !devicesLoading &&
                !devicesError && (
                  <div className={styles.notice}>
                    <p>
                      {copy(
                        "아직 다른 기기가 연결되어 있지 않아요. 기기를 바꾸기 전에 연결 코드를 보관해 두세요.",
                        "No other device is connected yet. Keep your code before switching devices.",
                      )}
                    </p>
                  </div>
                )}
            </>
          ) : (
            <>
              <p>
                {copy(
                  "첫 기록이 서버와 동기화되면 연결 코드가 생겨요.",
                  "Your connection code appears after your first record syncs.",
                )}
              </p>
              <div className={styles.actions}>
                <QuickLogAction className={styles.primary} />
              </div>
            </>
          )}
          <div className={styles.divider} />
          <h3>
            {copy(
              "다른 기기에 기록이 있나요?",
              "Have records on another device?",
            )}
          </h3>
          <p>
            {copy(
              "그 기기의 내 공간에서 코드를 확인해 여기서 이어보세요.",
              "Find the code in My space on that device to bring your records here.",
            )}
          </p>
          <form
            className={styles.pairForm}
            onSubmit={(event) => {
              event.preventDefault();
              void handlePair();
            }}
          >
            <label htmlFor="pairing-code">
              {copy("기록 연결 코드", "Record connection code")}
            </label>
            <input
              id="pairing-code"
              value={input}
              onChange={(event) => setInput(event.target.value.toUpperCase())}
              placeholder={tAccount("pairingCodePlaceholder")}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={styles.primary}
            >
              {loading ? tAccount("connecting") : tAccount("connectAction")}
            </button>
          </form>
          <details className={styles.details} style={{ marginTop: 16 }}>
            <summary>
              {copy("코드를 잃어버렸어요", "I lost my code")}
              <ChevronDown aria-hidden="true" size={18} />
            </summary>
            <p>
              {copy(
                "기록이 남아 있는 다른 기기의 내 공간이나, 개인적으로 보관한 보관 카드에서 코드를 찾아보세요.",
                "Look in My space on a device that still has your records, or in a recovery card you saved privately.",
              )}
            </p>
            <p>
              {copy(
                "코드와 연결된 기기를 모두 잃었다면 기록을 되찾을 수 없어요. 이메일이나 전화번호를 수집하지 않아 다른 복구 방법은 제공하지 않아요.",
                "If you have lost both your code and every connected device, the records cannot be recovered. We do not collect email addresses or phone numbers for recovery.",
              )}
            </p>
          </details>
        </section>
        <div className={styles.column}>
          <section className={styles.panel}>
            <div className={styles.deviceHeader}>
              <h2>{tAccount("connectedDevices")}</h2>
              {devices && !devicesLoading && (
                <span className={styles.count}>
                  {tAccount("connectedDevicesCount", { count: devices.length })}
                </span>
              )}
            </div>
            {initializing || devicesLoading ? (
              <p aria-live="polite">
                {copy(
                  "연결된 기기를 확인하고 있어요…",
                  "Checking connected devices…",
                )}
              </p>
            ) : devicesError ? (
              <>
                <p role="alert">
                  {copy(
                    "연결된 기기를 불러오지 못했어요.",
                    "Could not load connected devices.",
                  )}
                </p>
                <button
                  type="button"
                  className={styles.quiet}
                  onClick={() => void loadDevices()}
                >
                  {copy("다시 확인", "Try again")}
                </button>
              </>
            ) : !userId ? (
              <p>
                {copy(
                  "첫 기록을 동기화하거나 기존 연결 코드를 입력하면 이 기기가 연결돼요.",
                  "Sync your first record or enter an existing code to connect this device.",
                )}
              </p>
            ) : devices?.length === 0 ? (
              <p>{tAccount("noConnectedDevices")}</p>
            ) : (
              devices?.map((device) => {
                const current = device.id === deviceId;
                return (
                  <div key={device.id} className={styles.device}>
                    <Smartphone aria-hidden="true" size={22} />
                    <div>
                      <strong>
                        {current
                          ? tAccount("currentDevice")
                          : tAccount("otherDevice")}
                      </strong>
                      <p>
                        {device.browser ?? tAccount("browser")} ·{" "}
                        {device.os ?? tAccount("os")}
                      </p>
                      <p>
                        {tAccount("createdAt", {
                          date: formatShort(device.createdAt, locale),
                        })}{" "}
                        ·{" "}
                        {tAccount("lastActiveAt", {
                          date: formatShort(device.lastSeenAt, locale),
                        })}
                      </p>
                    </div>
                    {current ? (
                      <span className={styles.current}>
                        {tAccount("currentLabel")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void revokeDevice(device.id)}
                        disabled={loading}
                        className={styles.button}
                      >
                        {tAccount("unlinkAction")}
                      </button>
                    )}
                  </div>
                );
              })
            )}
            {devices && devices.length > 0 && (
              <button
                type="button"
                onClick={() => void revokeAll()}
                disabled={loading}
                className={styles.quiet}
              >
                {tAccount("unlinkAllAction")}
              </button>
            )}
          </section>
          <details className={`${styles.panel} ${styles.details}`}>
            <summary>
              {tAccount("accountInfoLabel")}
              <ChevronDown aria-hidden="true" size={18} />
            </summary>
            <div className={styles.identity}>
              <span>User ID</span>
              <code>{userId?.slice(0, 8) ?? "—"}</code>
            </div>
            <div className={styles.identity}>
              <span>Device ID</span>
              <code>{deviceId?.slice(0, 8) ?? "—"}</code>
            </div>
            <p>{tAccount("accountInfoNotice")}</p>
          </details>
          <section className={styles.panel}>
            <h2>
              {copy(
                "기록을 더 잘 이어가도록",
                "A little help with your records",
              )}
            </h2>
            <nav
              className={styles.linkList}
              aria-label={tAccount("groupSupportTitle")}
            >
              <IntlLink href="/feedback">
                {tAccount("feedbackAction")}
                <ArrowRight aria-hidden="true" size={17} />
              </IntlLink>
              <IntlLink href="/guide">
                {copy("기록 가이드", "Recording guides")}
                <ArrowRight aria-hidden="true" size={17} />
              </IntlLink>
              <IntlLink href="/about">
                {copy("ottline과 함께하는 방법", "Ways to use ottline")}
                <ArrowRight aria-hidden="true" size={17} />
              </IntlLink>
            </nav>
          </section>
          {showAndroidAppSection && (
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <Smartphone aria-hidden="true" size={22} />
                <h2>{tAccount("androidAppTitle")}</h2>
              </div>
              <p>{tAccount("androidAppDesc")}</p>
              <div className={styles.actions}>
                <a href="ottline://watch-reminder" className={styles.button}>
                  <Settings aria-hidden="true" size={18} />
                  {tAccount("androidWatchReminderAction")}
                </a>
              </div>
              <p>{tAccount("androidWatchReminderDesc")}</p>
            </section>
          )}
        </div>
      </div>
      <div className={styles.lowerGrid}>
        <section className={styles.panel}>
          <h2>{tAccount("exportTitle")}</h2>
          <p>
            {logs.length > 0
              ? tAccount("exportDescModern")
              : tAccount("exportDescEmpty")}
          </p>
          <fieldset className={styles.exportOptions}>
            <legend className="sr-only">{tAccount("exportRangeLabel")}</legend>
            {(["ALL", "video", "book"] as const).map((range) => (
              <button
                type="button"
                key={range}
                className={styles.button}
                aria-pressed={exportRange === range}
                onClick={() => setExportRange(range)}
              >
                {range === "ALL"
                  ? tAccount("rangeAll")
                  : range === "video"
                    ? tAccount("rangeVideo")
                    : tAccount("rangeBook")}
              </button>
            ))}
          </fieldset>
          <button
            type="button"
            onClick={() => void exportLogs()}
            disabled={exporting || logs.length === 0}
            className={styles.button}
          >
            <Download aria-hidden="true" size={18} />
            {exporting ? tAccount("exporting") : tAccount("exportAction")}
          </button>
          {exportStatus && <p aria-live="polite">{exportStatus}</p>}
          <p>{tAccount("exportNotice")}</p>
        </section>
        <details className={`${styles.panel} ${styles.details}`}>
          <summary>
            {copy(
              "기록과 연결 데이터 관리",
              "Manage records and connection data",
            )}
            <ChevronDown aria-hidden="true" size={18} />
          </summary>
          <div className={styles.dataAction}>
            <h3>{tAccount("resetLocalTitle")}</h3>
            <p>{tAccount("resetLocalDesc")}</p>
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => void handleResetLocal()}
                className={styles.dangerButton}
              >
                {tAccount("resetLocalAction")}
              </button>
            </div>
          </div>
          <div className={styles.dataAction}>
            <h3>{tAccount("deleteAccountTitle")}</h3>
            <p>{tAccount("deleteAccountDesc")}</p>
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => void deleteAccount()}
                disabled={loading || !userId}
                className={styles.dangerButton}
              >
                {tAccount("deleteAccountAction")}
              </button>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
