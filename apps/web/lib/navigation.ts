export type NavHref = "/" | "/timeline" | "/public" | "/account";

const LOCALE_PREFIX_PATTERN = /^\/(ko|en)(?=\/|$)/;

export function normalizeNavPathname(pathname: string) {
  const withoutLocale = pathname.replace(LOCALE_PREFIX_PATTERN, "") || "/";
  if (withoutLocale === "/") return withoutLocale;

  return withoutLocale.replace(/\/+$/, "");
}

export function getMatchedNavHref(pathname: string): NavHref | null {
  const normalized = normalizeNavPathname(pathname);

  if (normalized === "/") {
    return "/";
  }

  if (normalized === "/timeline" || normalized.startsWith("/timeline/")) {
    return "/timeline";
  }

  if (normalized === "/public" || normalized.startsWith("/public/")) {
    return "/public";
  }

  if (normalized === "/account" || normalized.startsWith("/account/")) {
    return "/account";
  }

  return null;
}

export function isNavHref(value: string | undefined): value is NavHref {
  return (
    value === "/" ||
    value === "/timeline" ||
    value === "/public" ||
    value === "/account"
  );
}
