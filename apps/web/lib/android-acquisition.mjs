export const GOOGLE_PLAY_TWA_SESSION_KEY =
  "ottline.android.googlePlayTwaSession";
export const ANDROID_ACQUISITION_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

const VERSION_NAME_PARAM = "android_app_version";
const VERSION_CODE_PARAM = "android_app_version_code";
const INSTALL_TOKEN_PARAM = "android_install_token";

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isAndroidUserAgent(userAgent) {
  return typeof userAgent === "string" && /android/i.test(userAgent);
}

export function isOttlineAndroidAppReferrer(referrer) {
  if (typeof referrer !== "string") return false;
  const normalized = referrer.trim().toLowerCase();
  return (
    normalized === "android-app://app.ottline" ||
    normalized.startsWith("android-app://app.ottline/")
  );
}

/**
 * Only signals written by the installed Google Play app can classify the
 * current browser session as TWA. Android WebView and standalone display mode
 * are intentionally excluded because they are also used by in-app browsers
 * and installed PWAs.
 */
export function googlePlayTwaSignal({
  userAgent,
  referrer,
  search,
  sessionRecorded = false,
}) {
  if (!isAndroidUserAgent(userAgent)) return null;

  if (isOttlineAndroidAppReferrer(referrer)) return "android_referrer";

  const params = new URLSearchParams(typeof search === "string" ? search : "");
  if (
    clean(params.get(VERSION_NAME_PARAM)) ||
    clean(params.get(VERSION_CODE_PARAM))
  ) {
    return "versioned_launch_url";
  }
  if (clean(params.get(INSTALL_TOKEN_PARAM))) return "install_token";
  if (sessionRecorded) return "session";

  return null;
}

export function isDismissalCooldownActive(
  storedValue,
  now = Date.now(),
  cooldownMs = ANDROID_ACQUISITION_COOLDOWN_MS,
) {
  if (typeof storedValue !== "string" || !storedValue.trim()) return false;
  const dismissedAt = Number(storedValue);
  if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) return false;
  return now - dismissedAt >= 0 && now - dismissedAt < cooldownMs;
}

export function shouldShowAndroidPlayPrompt({
  userAgent,
  displayMode = "browser",
  twaSignal,
  dismissalValue,
  now = Date.now(),
}) {
  const isSupportedSurface =
    displayMode === "browser" || displayMode === "standalone";
  return (
    isAndroidUserAgent(userAgent) &&
    isSupportedSurface &&
    !twaSignal &&
    !isDismissalCooldownActive(dismissalValue, now)
  );
}

export function shouldShowAndroidReminderCard({
  twaSignal,
  dismissalValue,
  now = Date.now(),
}) {
  return Boolean(twaSignal && !isDismissalCooldownActive(dismissalValue, now));
}
