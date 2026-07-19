import { ArrowRight, BookOpen, Clapperboard, Film } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import {
  GUIDE_LOCALES,
  type GuideSlug,
  getGuideDocuments,
  getGuideHub,
  isGuideLocale,
} from "@/lib/guides";
import { absoluteUrl, localizedAlternates, localizedUrl } from "@/lib/seo";

const guideIcons = {
  "ott-watch-log": Film,
  "movie-series-log": Clapperboard,
  "book-log": BookOpen,
} satisfies Record<GuideSlug, typeof Film>;

export function generateStaticParams() {
  return GUIDE_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isGuideLocale(locale)) notFound();

  const hub = getGuideHub(locale);

  return {
    title: hub.metaTitle,
    description: hub.metaDescription,
    alternates: localizedAlternates(locale, "/guide"),
    openGraph: {
      title: `${hub.metaTitle} | ottline`,
      description: hub.metaDescription,
      url: localizedUrl(locale, "/guide"),
      locale: locale === "ko" ? "ko_KR" : "en_US",
      alternateLocale: locale === "ko" ? ["en_US"] : ["ko_KR"],
      type: "website",
      images: [
        {
          url: absoluteUrl("/og-image-20260418.png"),
          width: 1200,
          height: 630,
          alt: "ottline",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${hub.metaTitle} | ottline`,
      description: hub.metaDescription,
      images: [absoluteUrl("/og-image-20260418.png")],
    },
  };
}

export default async function GuideHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isGuideLocale(locale)) notFound();
  setRequestLocale(locale);

  const hub = getGuideHub(locale);
  const guides = getGuideDocuments(locale);

  return (
    <div className="mx-auto max-w-4xl space-y-12 py-6 sm:py-10">
      <header className="max-w-3xl space-y-4">
        <p className="text-sm font-semibold text-brand-navy dark:text-foreground">
          {hub.eyebrow}
        </p>
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {hub.title}
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          {hub.description}
        </p>
      </header>

      <section aria-label={hub.metaTitle} className="grid gap-5 md:grid-cols-3">
        {guides.map((guide) => {
          const GuideIcon = guideIcons[guide.slug];

          return (
            <article
              key={guide.slug}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="relative h-52 overflow-hidden border-b border-border bg-muted">
                <Image
                  src={guide.image.src}
                  alt={guide.image.alt}
                  fill
                  sizes="(max-width: 767px) 100vw, 33vw"
                  className="object-cover object-top"
                />
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy dark:text-foreground">
                  <GuideIcon aria-hidden="true" className="h-4 w-4" />
                  <span>{guide.eyebrow}</span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold leading-snug">
                    {guide.cardTitle}
                  </h2>
                  <p className="text-base leading-7 text-muted-foreground">
                    {guide.cardDescription}
                  </p>
                </div>
                <Link
                  href={`/guide/${guide.slug}`}
                  aria-label={guide.cardAction}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-brand-navy underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-foreground"
                >
                  <span>{hub.cardLabel}</span>
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-lg border border-border bg-ott-paper-strong p-6 sm:p-8">
        <h2 className="text-xl font-semibold">{hub.closingTitle}</h2>
        <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
          {hub.closingDescription}
        </p>
      </section>
    </div>
  );
}
