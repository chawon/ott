import {
  getDeviceId,
  getPairingCode,
  getUserId,
  resetLocalState,
  setDeviceId,
  setPairingCode,
  setUserId,
} from "./localStore";

type AuthRegisterResponse = {
  userId: string;
  deviceId: string;
  pairingCode: string;
};

let authInitPromise: Promise<void> | null = null;

function getStoredAuth() {
  const userId = getUserId();
  const deviceId = getDeviceId();
  const pairingCode = getPairingCode();
  return { userId, deviceId, pairingCode };
}

const OLD_DOMAIN = "https://ott.preview.pe.kr";
const NEW_HOSTNAME = "ottline.app";
const MIGRATION_TIMEOUT_MS = 4000;

async function tryMigrateFromOldDomain(): Promise<boolean> {
  if (window.location.hostname !== NEW_HOSTNAME) return false;

  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.src = `${OLD_DOMAIN}/ko/migration-helper`;
    iframe.style.cssText = "display:none;position:fixed;width:0;height:0;";
    document.body.appendChild(iframe);

    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, MIGRATION_TIMEOUT_MS);

    function handleMessage(event: MessageEvent) {
      if (event.origin !== OLD_DOMAIN) return;
      if (event.data?.type !== "MIGRATION_DATA") return;
      cleanup();
      const { userId, deviceId, pairingCode } = event.data.payload ?? {};
      if (userId && deviceId && pairingCode) {
        setUserId(userId);
        setDeviceId(deviceId);
        setPairingCode(pairingCode);
        resolve(true);
      } else {
        resolve(false);
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

async function ensureClientAuth() {
  if (typeof window === "undefined") return;

  const { userId, deviceId, pairingCode } = getStoredAuth();
  if (userId && deviceId && pairingCode) return;

  if (authInitPromise) return authInitPromise;

  const promise = (async () => {
    const migrated = await tryMigrateFromOldDomain();
    if (migrated) return;

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

function buildHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers ?? {});
  const hasBody = init?.body !== undefined && init?.body !== null;
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const userId = getUserId();
  const deviceId = getDeviceId();
  if (userId) headers.set("X-User-Id", userId);
  if (deviceId) headers.set("X-Device-Id", deviceId);

  // Add current locale to Accept-Language header
  if (typeof document !== "undefined" && document.documentElement.lang) {
    headers.set("Accept-Language", document.documentElement.lang);
  }

  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: buildHeaders(init),
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      await resetLocalState();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:revoked"));
        window.location.reload();
      }
      throw new Error("Device access has been revoked");
    }
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

export async function ensureAuthIds(options?: { register?: boolean }) {
  if (options?.register === true) {
    await ensureClientAuth();
  }
  const { userId, deviceId } = getStoredAuth();
  return { userId, deviceId };
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, init);
}

export async function apiWithAuth<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { userId } = await ensureAuthIds({ register: false });
  if (!userId) {
    throw new Error("API auth required: missing user identity");
  }
  return request<T>(path, init);
}
