import { trackEvent } from "./analytics";
import {
  getDeviceId,
  getPairingCode,
  getUserId,
  setDeviceId,
  setPairingCode,
  setUserId,
} from "./localStore";
import { buildApiUrl } from "./url";

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
    const res = await fetch(buildApiUrl("/auth/register"), {
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
  const res = await fetch(buildApiUrl("/auth/pair"), {
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
