"use client";

import {
  type AndroidAppContext,
  type GooglePlayTwaSignal,
  getGooglePlayTwaSignal,
  readAndroidAppContext,
  readAndroidAppContextFromCurrentUrl,
} from "@/lib/androidAppContext";
import { ensureAnalyticsClientId, getUserId } from "@/lib/localStore";
import { safeUUID } from "@/lib/utils";
import {
  normalizeOwnedEntrySource,
  normalizePublicPageViewPath,
  pageOpenEventForPath,
  parsePendingAppOpen,
  shouldTrackAppOpenForSession,
} from "./analytics-session.mjs";

export {
  normalizeOwnedEntrySource,
  normalizePublicPageViewPath,
  pageOpenEventForPath,
  parsePendingAppOpen,
  shouldTrackAppOpenForSession,
} from "./analytics-session.mjs";

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
type RuntimeContext = {
  platform: AnalyticsPlatform;
  androidAppContext: AndroidAppContext | null;
  androidTwaSignal?: GooglePlayTwaSignal;
};
type UtmProperties = Partial<{
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
}>;

const ANALYTICS_SESSION_ID_KEY = "watchlog.analytics.sessionId";
const APP_OPEN_SENT_SESSION_KEY = "watchlog.analytics.appOpenSentSessionId";
const APP_OPEN_PENDING_KEY = "watchlog.analytics.appOpenPending";
const PUBLIC_PAGE_VIEW_SENT_PREFIX =
  "watchlog.analytics.publicPageViewSentSessionId";
const PUBLIC_PAGE_VIEW_PENDING_PREFIX =
  "watchlog.analytics.publicPageViewPending";
const CURATED_ATTRIBUTION_KEY = "watchlog.analytics.curatedAttribution";
const CURATED_IMPRESSION_PREFIX = "watchlog.analytics.curatedImpression";

export type CuratedAttribution = {
  curatedContentId: string;
  titleId: string;
  storedAt: number;
};

export function rememberCuratedAttribution(
  curatedContentId: string,
  titleId: string,
) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      CURATED_ATTRIBUTION_KEY,
      JSON.stringify({ curatedContentId, titleId, storedAt: Date.now() }),
    );
  } catch {
    // Attribution must never block navigation.
  }
}

export function readCuratedAttribution(): CuratedAttribution | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CURATED_ATTRIBUTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.curatedContentId !== "string" ||
      typeof parsed?.titleId !== "string" ||
      typeof parsed?.storedAt !== "number" ||
      Date.now() - parsed.storedAt > 86_400_000
    ) {
      sessionStorage.removeItem(CURATED_ATTRIBUTION_KEY);
      return null;
    }
    return parsed as CuratedAttribution;
  } catch {
    return null;
  }
}

export function clearCuratedAttribution() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(CURATED_ATTRIBUTION_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export function curatedImpressionStorageKey(curatedContentId: string) {
  return `${CURATED_IMPRESSION_PREFIX}:${curatedContentId}`;
}

type PendingAppOpen = {
  sessionId: string;
  eventId: string;
  occurredAt: string;
};

function detectRuntimeContext(): RuntimeContext {
  if (typeof window === "undefined") {
    return { platform: "web", androidAppContext: null };
  }
  const currentAndroidAppContext = readAndroidAppContextFromCurrentUrl();
  const storedAndroidAppContext = readAndroidAppContext();
  const androidAppContext = currentAndroidAppContext ?? storedAndroidAppContext;
  const isStandalone = window.matchMedia?.(
    "(display-mode: standalone)",
  ).matches;
  const androidTwaSignal = getGooglePlayTwaSignal() ?? undefined;

  if (androidTwaSignal) {
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

function getCurrentPathname() {
  if (typeof window === "undefined") return "unknown";
  return window.location.pathname || "/";
}

function getLandingPath() {
  return sessionValue("watchlog.analytics.landingPath", getCurrentPathname);
}

function getCurrentReferrerOrigin() {
  if (typeof document === "undefined") return "unknown";
  if (!document.referrer) return "direct";
  try {
    return new URL(document.referrer).origin;
  } catch {
    return "unknown";
  }
}

function getReferrerOrigin() {
  return sessionValue("watchlog.analytics.referrer", getCurrentReferrerOrigin);
}

function getCurrentUtmProperties(): UtmProperties {
  if (typeof window === "undefined") return {};

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
  return next;
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
  const next = getCurrentUtmProperties();
  sessionStorage.setItem(key, JSON.stringify(next));
  return next;
}

function getCurrentEntrySource() {
  if (typeof window === "undefined") return undefined;
  return (
    normalizeOwnedEntrySource(
      new URLSearchParams(window.location.search).get("source"),
    ) ?? undefined
  );
}

function getEntrySource() {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return undefined;
  }
  const key = "watchlog.analytics.entrySource";
  const existing = sessionStorage.getItem(key);
  if (existing !== null) {
    return normalizeOwnedEntrySource(existing) ?? undefined;
  }

  const source = getCurrentEntrySource();
  sessionStorage.setItem(key, source ?? "");
  return source ?? undefined;
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

function buildContextProperties(
  context: RuntimeContext,
  contextScope: "session" | "page" = "session",
) {
  const platform = context.platform;
  const isPageContext = contextScope === "page";
  const entrySource = isPageContext
    ? getCurrentEntrySource()
    : getEntrySource();
  return {
    hostname:
      typeof window !== "undefined" ? window.location.hostname : "unknown",
    landingPath: isPageContext ? getCurrentPathname() : getLandingPath(),
    referrer: isPageContext ? getCurrentReferrerOrigin() : getReferrerOrigin(),
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
    ...(entrySource ? { entrySource } : {}),
    ...buildAndroidAppProperties(context),
    ...(isPageContext ? getCurrentUtmProperties() : getUtmProperties()),
  };
}

function ensureSessionId(): string {
  if (typeof sessionStorage === "undefined") return `no-session-${safeUUID()}`;
  const existing = sessionStorage.getItem(ANALYTICS_SESSION_ID_KEY);
  if (existing) return existing;
  const created = safeUUID();
  sessionStorage.setItem(ANALYTICS_SESSION_ID_KEY, created);
  return created;
}

export async function trackEvent(
  eventName:
    | "app_open"
    | "public_page_view"
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
    | "recommendation_dismiss"
    | "h1_recap_impression"
    | "h1_recap_share"
    | "h1_recap_notice_impression"
    | "h1_recap_notice_click"
    | "h1_recap_notice_dismiss"
    | "bookshelf_open"
    | "bookshelf_category_open"
    | "guide_cta_click"
    | "android_play_cta_impression"
    | "android_play_cta_click"
    | "android_play_cta_dismiss"
    | "android_reminder_card_impression"
    | "android_reminder_card_open"
    | "android_reminder_card_dismiss"
    | "curated_impression"
    | "curated_open"
    | "curated_human_action",
  properties?: Record<string, unknown>,
  options?: {
    eventId?: string;
    occurredAt?: string;
    contextScope?: "session" | "page";
  },
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
        eventId: options?.eventId ?? safeUUID(),
        eventName,
        platform,
        sessionId: ensureSessionId(),
        clientVersion: "web",
        occurredAt: options?.occurredAt ?? new Date().toISOString(),
        properties: {
          ...buildContextProperties(runtimeContext, options?.contextScope),
          ...(properties ?? {}),
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Analytics ${res.status}`);
    }
    return true;
  } catch {
    // analytics should not break UX
    return false;
  }
}

export async function trackAppOpenOnce() {
  try {
    if (typeof sessionStorage === "undefined") return;

    const sessionId = ensureSessionId();
    const trackedSessionId = sessionStorage.getItem(APP_OPEN_SENT_SESSION_KEY);
    if (!shouldTrackAppOpenForSession(trackedSessionId, sessionId)) return;

    let pending: PendingAppOpen | null = parsePendingAppOpen(
      sessionStorage.getItem(APP_OPEN_PENDING_KEY),
      sessionId,
    );

    if (!pending) {
      pending = {
        sessionId,
        eventId: safeUUID(),
        occurredAt: new Date().toISOString(),
      };
      sessionStorage.setItem(APP_OPEN_PENDING_KEY, JSON.stringify(pending));
    }

    const sent = await trackEvent("app_open", undefined, pending);
    if (sent) {
      sessionStorage.setItem(APP_OPEN_SENT_SESSION_KEY, sessionId);
      sessionStorage.removeItem(APP_OPEN_PENDING_KEY);
    }
  } catch {
    // Analytics should not break UX when session storage is unavailable.
  }
}

async function trackPublicPageViewOnce(pathname: string) {
  try {
    if (typeof sessionStorage === "undefined") return;

    const publicPath = normalizePublicPageViewPath(pathname);
    if (!publicPath) return;

    const sessionId = ensureSessionId();
    const keySuffix = encodeURIComponent(publicPath);
    const sentKey = `${PUBLIC_PAGE_VIEW_SENT_PREFIX}:${keySuffix}`;
    const pendingKey = `${PUBLIC_PAGE_VIEW_PENDING_PREFIX}:${keySuffix}`;
    const trackedSessionId = sessionStorage.getItem(sentKey);
    if (!shouldTrackAppOpenForSession(trackedSessionId, sessionId)) return;

    let pending: PendingAppOpen | null = parsePendingAppOpen(
      sessionStorage.getItem(pendingKey),
      sessionId,
    );

    if (!pending) {
      pending = {
        sessionId,
        eventId: safeUUID(),
        occurredAt: new Date().toISOString(),
      };
      sessionStorage.setItem(pendingKey, JSON.stringify(pending));
    }

    const sent = await trackEvent(
      "public_page_view",
      { pagePath: publicPath },
      { ...pending, contextScope: "page" },
    );
    if (sent) {
      sessionStorage.setItem(sentKey, sessionId);
      sessionStorage.removeItem(pendingKey);
    }
  } catch {
    // Analytics should not break UX when session storage is unavailable.
  }
}

export async function trackPageOpenOnce(pathname: string) {
  if (pageOpenEventForPath(pathname) === "public_page_view") {
    await trackPublicPageViewOnce(pathname);
    return;
  }
  await trackAppOpenOnce();
}
