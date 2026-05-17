function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function ensureLeadingSlash(value: string) {
  return value.startsWith("/") ? value : `/${value}`;
}

export function getApiBaseUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!baseUrl) return "";
  return trimTrailingSlash(baseUrl);
}

export function buildAppUrl(path: string) {
  const normalizedPath = ensureLeadingSlash(path);
  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    return normalizedPath;
  }

  return `${baseUrl}${normalizedPath}`;
}

export function getCurrentLocale() {
  if (typeof document === "undefined") return "ko";
  const locale = document.documentElement.lang?.toLowerCase() ?? "ko";
  return locale.startsWith("en") ? "en" : "ko";
}

export function buildApiUrl(path: string) {
  const normalizedPath = ensureLeadingSlash(path);
  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    return `/api${normalizedPath}`;
  }

  return `${baseUrl}/api${normalizedPath}`;
}
