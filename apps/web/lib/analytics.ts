"use client";

import { ensureAnalyticsClientId, getUserId } from "@/lib/localStore";
import { safeUUID } from "@/lib/utils";

export type AnalyticsPlatform = "web" | "pwa" | "twa";
type DeviceType = "mobile" | "tablet" | "desktop";
type OsFamily = "ios" | "android" | "windows" | "macos" | "linux" | "chromeos" | "unknown";
type BrowserFamily =
  | "chrome"
  | "safari"
  | "edge"
  | "firefox"
  | "samsung_internet"
  | "in_app"
  | "unknown";
type InstallState = "browser" | "pwa_installed" | "twa";

function detectPlatform(): AnalyticsPlatform {
  if (typeof window === "undefined") return "web";
  const ua = window.navigator.userAgent.toLowerCase();
  const ref = document.referrer.toLowerCase();
  if (ref.startsWith("android-app://")) return "twa";
  if (window.matchMedia?.("(display-mode: standalone)").matches) return "pwa";
  if (ua.includes("android") && ua.includes(" wv")) return "twa";
  return "web";
}

function detectDeviceType(): DeviceType {
  if (typeof window === "undefined") return "desktop";
  const ua = window.navigator.userAgent.toLowerCase();
  const touchPoints = window.navigator.maxTouchPoints ?? 0;
  const isTablet =
    /ipad|tablet|playbook|silk/i.test(ua) ||
    (ua.includes("android") && !ua.includes("mobile")) ||
    (ua.includes("macintosh") && touchPoints > 1);
  if (isTablet) return "tablet";
  if (/mobi|iphone|ipod|android/i.test(ua)) return "mobile";
  return "desktop";
}

function detectOsFamily(): OsFamily {
  if (typeof window === "undefined") return "unknown";
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod|ios/.test(ua)) return "ios";
  if (ua.includes("android")) return "android";
  if (ua.includes("windows")) return "windows";
  if (ua.includes("mac os x") || ua.includes("macintosh")) return "macos";
  if (ua.includes("cros")) return "chromeos";
  if (ua.includes("linux")) return "linux";
  return "unknown";
}

function detectBrowserFamily(): BrowserFamily {
  if (typeof window === "undefined") return "unknown";
  const ua = window.navigator.userAgent.toLowerCase();
  if (ua.includes("wv") || ua.includes("; wv")) return "in_app";
  if (ua.includes("samsungbrowser")) return "samsung_internet";
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("firefox") || ua.includes("fxios")) return "firefox";
  if (ua.includes("crios") || ua.includes("chrome")) return "chrome";
  if (ua.includes("safari")) return "safari";
  return "unknown";
}

function detectInstallState(platform: AnalyticsPlatform): InstallState {
  if (platform === "twa") return "twa";
  if (platform === "pwa") return "pwa_installed";
  return "browser";
}

function buildContextProperties(platform: AnalyticsPlatform) {
  return {
    deviceType: detectDeviceType(),
    osFamily: detectOsFamily(),
    browserFamily: detectBrowserFamily(),
    installState: detectInstallState(platform),
  };
}

function ensureSessionId(): string {
  if (typeof sessionStorage === "undefined") return `no-session-${safeUUID()}`;
  const key = "watchlog.analytics.sessionId";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = safeUUID();
  sessionStorage.setItem(key, created);
  return created;
}

export async function trackEvent(
  eventName:
    | "app_open"
    | "login_success"
    | "log_create"
    | "share_action"
    | "retro_mode_toggle",
  properties?: Record<string, unknown>
) {
  try {
    const platform = detectPlatform();
    const userId = getUserId();
    const clientId = ensureAnalyticsClientId();

    const res = await fetch("/api/analytics/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userId ? { "X-User-Id": userId } : {}),
        ...(clientId ? { "X-Client-Id": clientId } : {}),
      },
      cache: "no-store",
      body: JSON.stringify({
        eventId: safeUUID(),
        eventName,
        platform,
        sessionId: ensureSessionId(),
        clientVersion: "web",
        occurredAt: new Date().toISOString(),
        properties: { ...buildContextProperties(platform), ...(properties ?? {}) },
      }),
    });

    if (!res.ok) {
      throw new Error(`Analytics ${res.status}`);
    }
  } catch {
    // analytics should not break UX
  }
}
