export type AndroidAppContext = {
  versionName?: string;
  versionCode?: string;
  launchPath: string;
  recordedAt: string;
  referrer?: string;
};

const STORAGE_KEY = "ottline.androidAppContext";
const VERSION_NAME_PARAM = "android_app_version";
const VERSION_CODE_PARAM = "android_app_version_code";
const INSTALL_TOKEN_PARAM = "android_install_token";

function cleanValue(value: string | null) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

export function recordAndroidAppContextFromCurrentUrl() {
  const context = readAndroidAppContextFromCurrentUrl();
  if (!context) return null;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch {
    return null;
  }

  return context;
}

export function readAndroidAppContextFromCurrentUrl() {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const versionName = cleanValue(params.get(VERSION_NAME_PARAM));
  const versionCode = cleanValue(params.get(VERSION_CODE_PARAM));
  if (!versionName && !versionCode) return null;

  return {
    versionName,
    versionCode,
    launchPath: sanitizedCurrentPath(),
    recordedAt: new Date().toISOString(),
    referrer: cleanValue(document.referrer),
  } satisfies AndroidAppContext;
}

export function readAndroidInstallTokenFromCurrentUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return cleanValue(params.get(INSTALL_TOKEN_PARAM));
}

export function removeAndroidInstallTokenFromCurrentUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(INSTALL_TOKEN_PARAM)) return;
  url.searchParams.delete(INSTALL_TOKEN_PARAM);
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

export function readAndroidAppContext(): AndroidAppContext | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AndroidAppContext;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function sanitizedCurrentPath() {
  const url = new URL(window.location.href);
  url.searchParams.delete(INSTALL_TOKEN_PARAM);
  return `${url.pathname}${url.search}`;
}
