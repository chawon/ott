import type { MetadataRoute } from "next";
import { GUIDE_SLUGS } from "@/lib/guides";
import { localizedUrl, PUBLIC_ORIGIN } from "@/lib/seo";
import { loadLatestPublicLogDate } from "@/lib/sitemap-public.mjs";

const CONTENT_DATE = new Date("2026-07-19T00:00:00+09:00");
const LOCALIZED_PATHS = [
  "/",
  "/about",
  "/faq",
  "/privacy",
  "/public",
  "/guide",
] as const;

function languageAlternates(pathname: string) {
  return {
    languages: {
      ko: localizedUrl("ko", pathname),
      en: localizedUrl("en", pathname),
      "x-default": localizedUrl("ko", pathname),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const backendUrl = process.env.BACKEND_URL;
  const [koPublicLastModified, enPublicLastModified] = await Promise.all([
    loadLatestPublicLogDate({ backendUrl, locale: "ko" }),
    loadLatestPublicLogDate({ backendUrl, locale: "en" }),
  ]);
  const publicLastModified = {
    ko: koPublicLastModified,
    en: enPublicLastModified,
  };
  const localizedEntries = LOCALIZED_PATHS.flatMap((pathname) =>
    (["ko", "en"] as const).map((locale) => ({
      url: localizedUrl(locale, pathname),
      lastModified:
        pathname === "/public" ? publicLastModified[locale] : CONTENT_DATE,
      alternates: languageAlternates(pathname),
    })),
  );
  const guideEntries = GUIDE_SLUGS.flatMap((slug) => {
    const pathname = `/guide/${slug}`;
    return (["ko", "en"] as const).map((locale) => ({
      url: localizedUrl(locale, pathname),
      lastModified: CONTENT_DATE,
      alternates: languageAlternates(pathname),
    }));
  });

  return [
    ...localizedEntries,
    ...guideEntries,
    {
      url: `${PUBLIC_ORIGIN}/chatgpt`,
      lastModified: CONTENT_DATE,
    },
  ];
}
