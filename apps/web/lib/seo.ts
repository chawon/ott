import type { Metadata } from "next";

export const PUBLIC_ORIGIN = "https://ottline.app";
export const PUBLIC_LOCALES = ["ko", "en"] as const;
export const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=app.ottline";
export const APP_STORE_URL = "https://apps.apple.com/app/ottline/id6780318110";
export const MICROSOFT_STORE_URL =
  "https://apps.microsoft.com/detail/9nsvnzgdmgf5";

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

export function localizedStoreUrls(locale: string) {
  if (locale === "en") {
    return {
      googlePlay: `${GOOGLE_PLAY_URL}&hl=en`,
      appStore: APP_STORE_URL,
    };
  }

  return {
    googlePlay: `${GOOGLE_PLAY_URL}&hl=ko&gl=KR`,
    appStore: "https://apps.apple.com/kr/app/ottline/id6780318110",
  };
}

export function buildSoftwareApplicationSchema({
  locale,
  description,
}: {
  locale: string;
  description: string;
}) {
  const isEnglish = locale === "en";
  const storeUrls = localizedStoreUrls(locale);

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": "https://ottline.app/#software-application",
    name: "ottline",
    url: localizedUrl(locale),
    description,
    inLanguage: isEnglish ? "en-US" : "ko-KR",
    applicationCategory: "LifestyleApplication",
    applicationSubCategory: "Entertainment",
    operatingSystem: ["Web", "Android", "iOS", "Windows"],
    sameAs: [GOOGLE_PLAY_URL, APP_STORE_URL, MICROSOFT_STORE_URL],
    installUrl: [storeUrls.googlePlay, storeUrls.appStore, MICROSOFT_STORE_URL],
    image: "https://ottline.app/icon.png",
    screenshot: [
      "https://ottline.app/pwa/screenshot-desktop-wide.png",
      "https://ottline.app/pwa/screenshot-mobile-narrow.png",
    ],
    offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
    isAccessibleForFree: true,
    featureList: isEnglish
      ? [
          "Start video and book logs without sign-up",
          "Local-first storage",
          "Personal timeline",
          "Pairing-code sync",
          "CSV export",
        ]
      : [
          "가입 없이 시작하는 영상·책 기록",
          "로컬 퍼스트 저장",
          "개인 타임라인",
          "페어링 코드 동기화",
          "CSV 내보내기",
        ],
  };
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
