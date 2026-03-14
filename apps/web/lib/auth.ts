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
const MIGRATION_TIMEOUT_MS = 5000;

async function tryMigrateFromOldDomain(): Promise<AuthInfo | null> {
  if (typeof window === "undefined") return null;
  
  const isLocal = 
    window.location.hostname === "localhost" || 
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "172.24.75.199" ||
    window.location.hostname.startsWith("172.");
  if (window.location.hostname !== NEW_HOSTNAME && !isLocal) {
    console.log("[AuthMigration] Domain check failed:", window.location.hostname);
    return null;
  }

  // If we already have auth info locally, don't migrate
  if (getUserId()) return null;

  console.log("[AuthMigration] No local auth info. Trying migration from:", OLD_DOMAIN);

  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.src = `${OLD_DOMAIN}/ko/migration-helper`;
    iframe.style.cssText = "display:none;position:fixed;width:0;height:0;z-index:-1;";
    
    const timer = setTimeout(() => {
      console.warn("[AuthMigration] Timed out waiting for migration data.");
      cleanup();
      resolve(null);
    }, MIGRATION_TIMEOUT_MS);

    function handleMessage(event: MessageEvent) {
      if (event.origin !== OLD_DOMAIN) return;
      if (event.data?.type !== "MIGRATION_DATA") return;
      
      const { userId, deviceId, pairingCode } = event.data.payload ?? {};
      console.log("[AuthMigration] Received data:", { userId: !!userId, deviceId: !!deviceId });
      
      cleanup();
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

    const appendIframe = () => {
      if (!document.body) {
        setTimeout(appendIframe, 100);
        return;
      }
      document.body.appendChild(iframe);
      console.log("[AuthMigration] Iframe appended to body.");
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", appendIframe);
    } else {
      appendIframe();
    }

    iframe.onload = () => {
      console.log("[AuthMigration] Iframe loaded, requesting data...");
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

  console.log("[Auth] Starting migration/registration flow...");
  const migrated = await tryMigrateFromOldDomain();
  if (migrated) {
    setUserId(migrated.userId);
    setDeviceId(migrated.deviceId);
    setPairingCode(migrated.pairingCode);
    await trackEvent("login_success", { method: "migration" });
    console.log("[Auth] Migration successful.");
    return migrated;
  }

  console.log("[Auth] No migration data found. Registering new account...");
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
  } catch (e) {
    console.error("[Auth] Registration failed:", e);
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
