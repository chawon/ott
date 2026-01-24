import { setDeviceId, setPairingCode, setUserId } from "./localStore";

type AuthRegisterResponse = {
  userId: string;
  deviceId: string;
  pairingCode: string;
};

let authInitPromise: Promise<void> | null = null;

async function ensureClientAuth(path: string) {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  if (path.startsWith("/auth/")) return; // auth endpoints should not recurse

  const userId = localStorage.getItem("watchlog.userId");
  const deviceId = localStorage.getItem("watchlog.deviceId");
  const pairingCode = localStorage.getItem("watchlog.pairingCode");
  if (userId && deviceId && pairingCode) return;

  if (authInitPromise) return authInitPromise;

  const promise = (async () => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Auth register failed: ${res.statusText}`);
    }
    const body = (await res.json()) as AuthRegisterResponse;
    setUserId(body.userId);
    setDeviceId(body.deviceId);
    setPairingCode(body.pairingCode);
  })();

  authInitPromise = promise;
  try {
    await promise;
  } finally {
    authInitPromise = null;
  }
}

export async function ensureAuthIds() {
    await ensureClientAuth("/sync/push");
    const userId = typeof localStorage !== "undefined" ? localStorage.getItem("watchlog.userId") : null;
    const deviceId = typeof localStorage !== "undefined" ? localStorage.getItem("watchlog.deviceId") : null;
    return { userId, deviceId };
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
    await ensureClientAuth(path);

    const userId = typeof localStorage !== "undefined" ? localStorage.getItem("watchlog.userId") : null;
    const deviceId = typeof localStorage !== "undefined" ? localStorage.getItem("watchlog.deviceId") : null;

    const res = await fetch(`/api${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(userId ? { "X-User-Id": userId } : {}),
            ...(deviceId ? { "X-Device-Id": deviceId } : {}),
            ...(init?.headers ?? {}),
        },
        cache: "no-store",
    });

    if (!res.ok) {
        let msg = res.statusText;
        try {
            const body = await res.json();
            msg = body?.message ?? JSON.stringify(body);
        } catch {
            const text = await res.text().catch(() => "");
            if (text) msg = text;
        }
        throw new Error(`API ${res.status}: ${msg}`);
    }
    const text = await res.text();
    if (!text) return null as T;
    return JSON.parse(text) as T;
}
