import type { Metadata } from "next";

export const PUBLIC_ORIGIN = "https://ottline.app";
export const PUBLIC_LOCALES = ["ko", "en"] as const;

export type PublicLocale = (typeof PUBLIC_LOCALES)[number];

export function normalizePublicLocale(locale: string): PublicLocale {
  return locale === "en" ? "en" : "ko";
}

export function localizedPath(locale: string, pathname = "/") {
  const normalizedLocale = normalizePublicLocale(locale);
  const normalizedPath =
    pathname === "/" ? "" : `/${pathname.replace(/^\/+|\/+$/g, "")}`;

  if (normalizedLocale === "en") {
    return `/en${normalizedPath}`;
  }

  return normalizedPath || "/";
}

export function absoluteUrl(pathname: string) {
  return new URL(pathname, PUBLIC_ORIGIN).toString();
}

export function localizedUrl(locale: string, pathname = "/") {
  return absoluteUrl(localizedPath(locale, pathname));
}

export function localizedAlternates(
  locale: string,
  pathname = "/",
): NonNullable<Metadata["alternates"]> {
  return {
    canonical: localizedUrl(locale, pathname),
    languages: {
      ko: localizedUrl("ko", pathname),
      en: localizedUrl("en", pathname),
      "x-default": localizedUrl("ko", pathname),
    },
  };
}

export function localizedOpenGraph(
  locale: string,
  pathname: string,
  title: string,
  description: string,
): NonNullable<Metadata["openGraph"]> {
  const normalizedLocale = normalizePublicLocale(locale);

  return {
    title,
    description,
    url: localizedUrl(normalizedLocale, pathname),
    siteName: "ottline",
    locale: normalizedLocale === "ko" ? "ko_KR" : "en_US",
    type: "website",
    images: [
      {
        url: absoluteUrl("/og-image-20260418.png"),
        width: 1200,
        height: 630,
        alt: "ottline",
      },
    ],
  };
}

export const privateRouteMetadata: Metadata = {
  alternates: {
    canonical: null,
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};
