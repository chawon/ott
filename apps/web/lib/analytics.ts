"use client";

import {
  type AndroidAppContext,
  readAndroidAppContext,
  readAndroidAppContextFromCurrentUrl,
} from "@/lib/androidAppContext";
import { ensureAnalyticsClientId, getUserId } from "@/lib/localStore";
import { safeUUID } from "@/lib/utils";

export type AnalyticsPlatform = "web" | "pwa" | "twa";
type DeviceType = "mobile" | "tablet" | "desktop";
type OsFamily =
  | "ios"
  | "android"
  | "windows"
  | "macos"
  | "linux"
  | "chromeos"
  | "unknown";
type BrowserFamily =
  | "chrome"
  | "safari"
  | "edge"
  | "firefox"
  | "samsung_internet"
  | "in_app"
  | "unknown";
type InstallState = "browser" | "pwa_installed" | "twa";
type AndroidTwaSignal =
  | "android_referrer"
  | "versioned_launch_url"
  | "android_webview"
  | "android_standalone_context"
  | "session";
type RuntimeContext = {
  platform: AnalyticsPlatform;
  androidAppContext: AndroidAppContext | null;
  androidTwaSignal?: AndroidTwaSignal;
};
type UtmProperties = Partial<{
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
}>;

const ANDROID_TWA_SESSION_KEY = "ottline.analytics.androidTwaSession";
const ANDROID_APP_CONTEXT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function hasAndroidAppVersionContext(context: AndroidAppContext | null) {
  return Boolean(context?.versionName || context?.versionCode);
}

function isRecentAndroidAppContext(context: AndroidAppContext | null) {
  if (!hasAndroidAppVersionContext(context)) return false;
  const recordedAt = Date.parse(context?.recordedAt ?? "");
  if (!Number.isFinite(recordedAt)) return false;
  return Date.now() - recordedAt <= ANDROID_APP_CONTEXT_MAX_AGE_MS;
}

function readAndroidTwaSessionFlag() {
  try {
    return sessionStorage.getItem(ANDROID_TWA_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markAndroidTwaSession() {
  try {
    sessionStorage.setItem(ANDROID_TWA_SESSION_KEY, "1");
  } catch {
    // Ignore storage failures. Analytics should keep the app usable.
  }
}

function detectRuntimeContext(): RuntimeContext {
  if (typeof window === "undefined") {
    return { platform: "web", androidAppContext: null };
  }
  const ua = window.navigator.userAgent.toLowerCase();
  const ref = document.referrer.toLowerCase();
  const currentAndroidAppContext = readAndroidAppContextFromCurrentUrl();
  const storedAndroidAppContext = readAndroidAppContext();
  const androidAppContext = currentAndroidAppContext ?? storedAndroidAppContext;
  const isAndroid = ua.includes("android");
  const isStandalone = window.matchMedia?.(
    "(display-mode: standalone)",
  ).matches;
  const hasCurrentVersionContext = hasAndroidAppVersionContext(
    currentAndroidAppContext,
  );
  const hasRecentStoredVersionContext = isRecentAndroidAppContext(
    storedAndroidAppContext,
  );

  let androidTwaSignal: AndroidTwaSignal | undefined;
  if (ref.startsWith("android-app://")) {
    androidTwaSignal = "android_referrer";
  } else if (hasCurrentVersionContext) {
    androidTwaSignal = "versioned_launch_url";
  } else if (isAndroid && ua.includes(" wv")) {
    androidTwaSignal = "android_webview";
  } else if (isAndroid && isStandalone && hasRecentStoredVersionContext) {
    androidTwaSignal = "android_standalone_context";
  } else if (readAndroidTwaSessionFlag()) {
    androidTwaSignal = "session";
  }

  if (androidTwaSignal) {
    markAndroidTwaSession();
    return {
      platform: "twa",
      androidAppContext,
      androidTwaSignal,
    };
  }

  if (isStandalone) {
    return { platform: "pwa", androidAppContext };
  }

  return { platform: "web", androidAppContext };
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

function sessionValue(key: string, fallback: () => string) {
  if (typeof sessionStorage === "undefined") return fallback();
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const next = fallback();
  sessionStorage.setItem(key, next);
  return next;
}

function getLandingPath() {
  if (typeof window === "undefined") return "unknown";
  return sessionValue(
    "watchlog.analytics.landingPath",
    () => window.location.pathname || "/",
  );
}

function getReferrerOrigin() {
  if (typeof document === "undefined") return "unknown";
  return sessionValue("watchlog.analytics.referrer", () => {
    if (!document.referrer) return "direct";
    try {
      return new URL(document.referrer).origin;
    } catch {
      return "unknown";
    }
  });
}

function getUtmProperties(): UtmProperties {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return {};
  }
  const key = "watchlog.analytics.utm";
  const existing = sessionStorage.getItem(key);
  if (existing) {
    try {
      return JSON.parse(existing) as UtmProperties;
    } catch {
      return {};
    }
  }
  const params = new URLSearchParams(window.location.search);
  const next: UtmProperties = {};
  const mappings = [
    ["utm_source", "utmSource"],
    ["utm_medium", "utmMedium"],
    ["utm_campaign", "utmCampaign"],
    ["utm_term", "utmTerm"],
    ["utm_content", "utmContent"],
  ] as const;
  for (const [param, prop] of mappings) {
    const value = params.get(param)?.trim();
    if (value) next[prop] = value.slice(0, 128);
  }
  sessionStorage.setItem(key, JSON.stringify(next));
  return next;
}

function buildAndroidAppProperties(context: RuntimeContext) {
  const androidAppContext = context.androidAppContext;
  if (!context.androidTwaSignal) return {};

  return {
    ...(androidAppContext?.versionName
      ? { androidAppVersion: androidAppContext.versionName }
      : {}),
    ...(androidAppContext?.versionCode
      ? { androidAppVersionCode: androidAppContext.versionCode }
      : {}),
    ...(context.androidTwaSignal
      ? { androidTwaSignal: context.androidTwaSignal }
      : {}),
  };
}

function buildContextProperties(context: RuntimeContext) {
  const platform = context.platform;
  return {
    hostname:
      typeof window !== "undefined" ? window.location.hostname : "unknown",
    landingPath: getLandingPath(),
    referrer: getReferrerOrigin(),
    locale:
      typeof document !== "undefined"
        ? document.documentElement.lang || "unknown"
        : "unknown",
    browserLocale:
      typeof navigator !== "undefined" ? navigator.language : "unknown",
    deviceType: detectDeviceType(),
    osFamily: detectOsFamily(),
    browserFamily: detectBrowserFamily(),
    installState: detectInstallState(platform),
    ...buildAndroidAppProperties(context),
    ...getUtmProperties(),
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
    | "first_log_create"
    | "activation_impression"
    | "activation_dismiss"
    | "activation_content_type_select"
    | "activation_status_select"
    | "title_search"
    | "title_select"
    | "recommendation_open"
    | "recommendation_refresh"
    | "recommendation_dismiss",
  properties?: Record<string, unknown>,
) {
  try {
    const runtimeContext = detectRuntimeContext();
    const platform = runtimeContext.platform;
    const userId = getUserId();
    const clientId = ensureAnalyticsClientId();

    const res = await fetch("/api/nalytic/events", {
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
        properties: {
          ...buildContextProperties(runtimeContext),
          ...(properties ?? {}),
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Analytics ${res.status}`);
    }
  } catch {
    // analytics should not break UX
  }
}
