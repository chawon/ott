import { api } from "./api";
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

export async function ensureAuth(): Promise<AuthInfo | null> {
  const userId = getUserId();
  const deviceId = getDeviceId();
  const pairingCode = getPairingCode();
  if (userId && deviceId && pairingCode) {
    return { userId, deviceId, pairingCode };
  }
  try {
    const res = await api<AuthInfo>("/auth/register", { method: "POST" });
    setUserId(res.userId);
    setDeviceId(res.deviceId);
    setPairingCode(res.pairingCode);
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
  return res;
}
