"use client";

import { useEffect, useState } from "react";
import {
  getGooglePlayTwaSignal,
  readAndroidInstallTokenFromCurrentUrl,
  recordAndroidAppContextFromCurrentUrl,
  removeAndroidInstallTokenFromCurrentUrl,
} from "@/lib/androidAppContext";
import { bindAndroidNotificationDevice } from "@/lib/androidNotifications";
import { ensureAuth } from "@/lib/auth";
import {
  countLogsLocal,
  getCachedUserProfile,
  getDeviceId,
  getPairingCode,
  getUserId,
  listOutbox,
} from "@/lib/localStore";
import { syncOutbox } from "@/lib/sync";

function buildNativeHandoffUri(params: {
  status: "ok" | "empty";
  userId?: string | null;
  deviceId?: string | null;
  pairingCode?: string | null;
  nickname?: string | null;
  personaKey?: string | null;
}) {
  const sp = new URLSearchParams();
  sp.set("handoff", "1");
  sp.set("status", params.status);
  if (params.userId) sp.set("user_id", params.userId);
  if (params.deviceId) sp.set("device_id", params.deviceId);
  if (params.pairingCode) sp.set("pairing_code", params.pairingCode);
  if (params.nickname) sp.set("nickname", params.nickname);
  if (params.personaKey) sp.set("persona_key", params.personaKey);
  return `ottline://open?${sp.toString()}`;
}

export default function AndroidAppContextRecorder() {
  const [handoffState, setHandoffState] = useState<{
    active: boolean;
    readyUrl: string | null;
    hasRecords: boolean;
    isEn: boolean;
  }>({
    active: false,
    readyUrl: null,
    hasRecords: false,
    isEn: false,
  });

  useEffect(() => {
    getGooglePlayTwaSignal();
    const installToken = readAndroidInstallTokenFromCurrentUrl();
    const context = recordAndroidAppContextFromCurrentUrl();
    if (installToken) {
      removeAndroidInstallTokenFromCurrentUrl();
      bindAndroidNotificationDevice(installToken, context).catch(() => {
        // Binding must not block the app shell. The next Android launch can retry.
      });
    }

    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("native_handoff") !== "1") return;

    const isEn = window.location.pathname.startsWith("/en");
    setHandoffState({
      active: true,
      readyUrl: null,
      hasRecords: true,
      isEn,
    });

    let cancelled = false;
    (async () => {
      try {
        let userId = getUserId();
        let deviceId = getDeviceId();
        let pairingCode = getPairingCode();
        const localCount = await countLogsLocal().catch(() => 0);
        const outboxItems = await listOutbox().catch(() => []);

        if ((!userId || !deviceId) && (localCount > 0 || outboxItems.length > 0)) {
          const auth = await ensureAuth().catch(() => null);
          if (auth) {
            userId = auth.userId;
            deviceId = auth.deviceId;
            pairingCode = auth.pairingCode;
          }
        }

        if (userId && deviceId && outboxItems.length > 0) {
          await Promise.race([
            syncOutbox().catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, 3500)),
          ]);
        }

        const profile = getCachedUserProfile();
        const hasSession = Boolean(userId && deviceId);
        const targetUrl = hasSession
          ? buildNativeHandoffUri({
              status: "ok",
              userId,
              deviceId,
              pairingCode,
              nickname: profile?.nickname ?? null,
              personaKey: profile?.personaKey ?? null,
            })
          : buildNativeHandoffUri({ status: "empty" });

        if (!cancelled) {
          setHandoffState({
            active: true,
            readyUrl: targetUrl,
            hasRecords: hasSession,
            isEn,
          });
          window.location.replace(targetUrl);
        }
      } catch {
        const fallbackUrl = buildNativeHandoffUri({ status: "empty" });
        if (!cancelled) {
          setHandoffState({
            active: true,
            readyUrl: fallbackUrl,
            hasRecords: false,
            isEn,
          });
          window.location.replace(fallbackUrl);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!handoffState.active) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F8F6F2] px-6 text-center text-[#1F1A15]">
      <div className="w-full max-w-sm rounded-2xl border border-[#E3DCD2] bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold tracking-wider text-[#1E4D8C]">
          OTTLINE 2.0
        </p>
        <h1 className="mt-2 text-lg font-bold text-[#1F1A15]">
          {handoffState.isEn
            ? "Connecting your previous records"
            : "기존 기록을 앱으로 이어받고 있어요"}
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-[#6B6258]">
          {handoffState.readyUrl
            ? handoffState.isEn
              ? "Tap the button below to return to the app with your timeline."
              : "자동으로 돌아가지 않는다면 아래 버튼을 눌러 바로 이어가세요."
            : handoffState.isEn
              ? "Checking your previous browser timeline..."
              : "이전 버전에서 남긴 기록을 확인하고 있어요..."}
        </p>
        {handoffState.readyUrl ? (
          <a
            href={handoffState.readyUrl}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#1E4D8C] px-5 py-3 text-sm font-bold text-[#F8F6F2]"
          >
            {handoffState.hasRecords
              ? handoffState.isEn
                ? "Continue in app with my records"
                : "이전 기록 연결하고 앱으로 돌아가기"
              : handoffState.isEn
                ? "Return to app"
                : "앱으로 돌아가기"}
          </a>
        ) : null}
      </div>
    </div>
  );
}
