import type { MetadataRoute } from "next";
import { GUIDE_SLUGS, getGuideDocument } from "@/lib/guides";
import { localizedUrl, PUBLIC_ORIGIN } from "@/lib/seo";
import { loadLatestPublicLogDate } from "@/lib/sitemap-public.mjs";

const CONTENT_DATE = new Date("2026-07-19T00:00:00+09:00");
const V2_CONTENT_DATE = new Date("2026-11-08T00:00:00+09:00");
const PRIVACY_DATE = new Date("2026-11-08T00:00:00+09:00");
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
  const guideLastModified = (locale: "ko" | "en") =>
    new Date(
      Math.max(
        V2_CONTENT_DATE.getTime(),
        ...GUIDE_SLUGS.map((slug) =>
          new Date(
            `${getGuideDocument(locale, slug).updatedAt}T00:00:00+09:00`,
          ).getTime(),
        ),
      ),
    );
  const localizedEntries = LOCALIZED_PATHS.flatMap((pathname) =>
    (["ko", "en"] as const).map((locale) => ({
      url: localizedUrl(locale, pathname),
      lastModified:
        pathname === "/public"
          ? publicLastModified[locale]
          : pathname === "/guide"
            ? guideLastModified(locale)
            : pathname === "/privacy"
              ? PRIVACY_DATE
              : V2_CONTENT_DATE,
      alternates: languageAlternates(pathname),
    })),
  );
  const guideEntries = GUIDE_SLUGS.flatMap((slug) => {
    const pathname = `/guide/${slug}`;
    return (["ko", "en"] as const).map((locale) => {
      const guide = getGuideDocument(locale, slug);

      return {
        url: localizedUrl(locale, pathname),
        lastModified: new Date(`${guide.updatedAt}T00:00:00+09:00`),
        alternates: languageAlternates(pathname),
      };
    });
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
