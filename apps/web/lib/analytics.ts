"use client";

import { api } from "@/lib/api";
import { safeUUID } from "@/lib/utils";

export type AnalyticsPlatform = "web" | "pwa" | "twa";

function detectPlatform(): AnalyticsPlatform {
  if (typeof window === "undefined") return "web";
  const ua = window.navigator.userAgent.toLowerCase();
  const ref = document.referrer.toLowerCase();
  if (ref.startsWith("android-app://")) return "twa";
  if (window.matchMedia?.("(display-mode: standalone)").matches) return "pwa";
  if (ua.includes("android") && ua.includes(" wv")) return "twa";
  return "web";
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
    | "retro_mode_toggle"
    | "onboarding_first_log_view"
    | "onboarding_first_log_step_next"
    | "onboarding_first_log_skip"
    | "onboarding_first_log_complete",
  properties?: Record<string, unknown>
) {
  try {
    await api("/analytics/events", {
      method: "POST",
      body: JSON.stringify({
        eventId: safeUUID(),
        eventName,
        platform: detectPlatform(),
        sessionId: ensureSessionId(),
        clientVersion: "web",
        occurredAt: new Date().toISOString(),
        properties: properties ?? {},
      }),
    });
  } catch {
    // analytics should not break UX
  }
}
