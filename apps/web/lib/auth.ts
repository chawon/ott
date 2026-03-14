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
const NEW_HOSTNAME = process.env.NEXT_PUBLIC_NEW_HOSTNAME || "ottline.app";
const MIGRATION_TIMEOUT_MS = 3000;

async function tryMigrateFromOldDomain(): Promise<AuthInfo | null> {
  if (typeof window === "undefined") return null;
  
  // Allow migration only on NEW_HOSTNAME or localhost for testing
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (window.location.hostname !== NEW_HOSTNAME && !isLocal) return null;

  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    // Use fixed locale for migration helper to ensure path exists
    iframe.src = `${OLD_DOMAIN}/ko/migration-helper`;
    iframe.style.cssText = "display:none;position:fixed;width:0;height:0;z-index:-1;";
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
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
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
  
  // 1. If we already have auth info, return it
  if (userId && deviceId && pairingCode) {
    return { userId, deviceId, pairingCode };
  }

  // 2. Try migration from old domain (only if we have no local auth info)
  const migrated = await tryMigrateFromOldDomain();
  if (migrated) {
    setUserId(migrated.userId);
    setDeviceId(migrated.deviceId);
    setPairingCode(migrated.pairingCode);
    await trackEvent("login_success", { method: "migration" });
    return migrated;
  }

  // 3. Fallback to registration
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Registration failed");
    const body = await res.json() as AuthInfo;
    
    setUserId(body.userId);
    setDeviceId(body.deviceId);
    setPairingCode(body.pairingCode);
    await trackEvent("login_success", { method: "register" });
    return body;
  } catch {
    return null;
  }
}

export async function pairWithCode(code: string): Promise<AuthInfo> {
  const oldUserId = getUserId();
  const res = await fetch("/api/auth/pair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, oldUserId }),
  });
  if (!res.ok) throw new Error("Pairing failed");
  const body = await res.json() as AuthInfo;
  
  setUserId(body.userId);
  setDeviceId(body.deviceId);
  setPairingCode(body.pairingCode);
  await trackEvent("login_success", { method: "pair" });
  return body;
}
