export type AndroidAppContext = {
  versionName?: string;
  versionCode?: string;
  launchPath: string;
  recordedAt: string;
  referrer?: string;
};

const STORAGE_KEY = "ottline.androidAppContext";

function cleanValue(value: string | null) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

export function recordAndroidAppContextFromCurrentUrl() {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const versionName = cleanValue(params.get("android_app_version"));
  const versionCode = cleanValue(params.get("android_app_version_code"));
  if (!versionName && !versionCode) return null;

  const context: AndroidAppContext = {
    versionName,
    versionCode,
    launchPath: `${window.location.pathname}${window.location.search}`,
    recordedAt: new Date().toISOString(),
    referrer: cleanValue(document.referrer),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch {
    return null;
  }

  return context;
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
