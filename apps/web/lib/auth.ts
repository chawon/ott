import { trackEvent } from "./analytics";
import {
  clearUserProfileState,
  getDeviceId,
  getPairingCode,
  getUserId,
  setDeviceId,
  setPairingCode,
  setUserId,
  transferPairedOutbox,
} from "./localStore";

export type AuthInfo = {
  userId: string;
  deviceId: string;
  pairingCode: string;
};

export async function ensureAuth(): Promise<AuthInfo | null> {
  const userId = getUserId();
  const deviceId = getDeviceId();
  const pairingCode = getPairingCode();

  if (userId && deviceId && pairingCode) {
    return { userId, deviceId, pairingCode };
  }

  // Fallback to registration (Silent migration is no longer possible via iframe)
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // Explicit empty body for some proxy/server setups
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      throw new Error(
        `Registration failed with status ${res.status}: ${errorText}`,
      );
    }
    const body = (await res.json()) as AuthInfo;

    clearUserProfileState();
    setUserId(body.userId);
    setDeviceId(body.deviceId);
    setPairingCode(body.pairingCode);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:changed"));
    }
    await trackEvent("login_success", { method: "register" });
    return body;
  } catch (e) {
    console.error("[Auth] Registration failed:", e);
    return null;
  }
}

export async function pairWithCode(code: string): Promise<AuthInfo> {
  const oldUserId = getUserId();
  const oldDeviceId = getDeviceId();
  const res = await fetch("/api/auth/pair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, oldUserId }),
  });
  if (!res.ok) throw new Error("Pairing failed");
  const body = (await res.json()) as AuthInfo;

  const checkSource = () => {
    if (getUserId() !== oldUserId || getDeviceId() !== oldDeviceId)
      throw new Error("The active account changed during pairing");
  };
  checkSource();
  await transferPairedOutbox(oldUserId, body.userId, checkSource);
  checkSource();
  clearUserProfileState();
  setUserId(body.userId);
  setDeviceId(body.deviceId);
  setPairingCode(body.pairingCode);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:changed"));
  }
  await trackEvent("login_success", { method: "pair" });
  return body;
}
