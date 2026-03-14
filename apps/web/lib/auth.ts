import { api } from "./api";
import { trackEvent } from "./analytics";
import {
  getDeviceId,
  getPairingCode,
  getUserId,
  setDeviceId,
  setPairingCode,
  setUserId,
} from "./localStore";

export type AuthInfo = {
  userId: string;
  deviceId: string;
  pairingCode: string;
};

const OLD_DOMAIN = "https://ott.preview.pe.kr";
const NEW_HOSTNAME = "ottline.app";
const MIGRATION_TIMEOUT_MS = 4000;

async function tryMigrateFromOldDomain(): Promise<AuthInfo | null> {
  if (typeof window === "undefined") return null;
  if (window.location.hostname !== NEW_HOSTNAME) return null;

  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.src = `${OLD_DOMAIN}/ko/migration-helper`;
    iframe.style.cssText = "display:none;position:fixed;width:0;height:0;";
    document.body.appendChild(iframe);

    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, MIGRATION_TIMEOUT_MS);

    function handleMessage(event: MessageEvent) {
      if (event.origin !== OLD_DOMAIN) return;
      if (event.data?.type !== "MIGRATION_DATA") return;
      cleanup();
      const { userId, deviceId, pairingCode } = event.data.payload ?? {};
      if (userId && deviceId && pairingCode) {
        resolve({ userId, deviceId, pairingCode });
      } else {
        resolve(null);
      }
    }

    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener("message", handleMessage);
      document.body.removeChild(iframe);
    }

    window.addEventListener("message", handleMessage);

    iframe.onload = () => {
      iframe.contentWindow?.postMessage(
        { type: "REQUEST_MIGRATION_DATA" },
        OLD_DOMAIN
      );
    };
  });
}

export async function ensureAuth(): Promise<AuthInfo | null> {
  const userId = getUserId();
  const deviceId = getDeviceId();
  const pairingCode = getPairingCode();
  if (userId && deviceId && pairingCode) {
    return { userId, deviceId, pairingCode };
  }

  const migrated = await tryMigrateFromOldDomain();
  if (migrated) {
    setUserId(migrated.userId);
    setDeviceId(migrated.deviceId);
    setPairingCode(migrated.pairingCode);
    await trackEvent("login_success", { method: "migration" });
    return migrated;
  }

  try {
    const res = await api<AuthInfo>("/auth/register", { method: "POST" });
    setUserId(res.userId);
    setDeviceId(res.deviceId);
    setPairingCode(res.pairingCode);
    await trackEvent("login_success", { method: "register" });
    return res;
  } catch {
    return null;
  }
}

export async function pairWithCode(code: string): Promise<AuthInfo> {
  const oldUserId = getUserId();
  const res = await api<AuthInfo>("/auth/pair", {
    method: "POST",
    body: JSON.stringify({ code, oldUserId }),
  });
  setUserId(res.userId);
  setDeviceId(res.deviceId);
  setPairingCode(res.pairingCode);
  await trackEvent("login_success", { method: "pair" });
  return res;
}
