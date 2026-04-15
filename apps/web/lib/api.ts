import {
  getDeviceId,
  getPairingCode,
  getUserId,
  resetLocalState,
} from "./localStore";
import { ensureAuth } from "./auth"; // Import migration-aware auth
import { buildApiUrl } from "./url";

type AuthRegisterResponse = {
  userId: string;
  deviceId: string;
  pairingCode: string;
};

function getStoredAuth() {
  const userId = getUserId();
  const deviceId = getDeviceId();
  const pairingCode = getPairingCode();
  return { userId, deviceId, pairingCode };
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
  const res = await fetch(buildApiUrl(path), {
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

// Now delegating to migration-aware ensureAuth in auth.ts
export async function ensureAuthIds(options?: { register?: boolean }) {
  const auth = await ensureAuth();
  if (!auth && options?.register) {
    throw new Error("Failed to ensure authentication");
  }
  return {
    userId: auth?.userId ?? null,
    deviceId: auth?.deviceId ?? null,
  };
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, init);
}

export async function apiWithAuth<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { userId } = await ensureAuthIds({ register: true });
  if (!userId) {
    throw new Error("API auth required: missing user identity");
  }
  return request<T>(path, init);
}
