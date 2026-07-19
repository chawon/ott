import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import GuideCtaLink from "@/components/GuideCtaLink";
import { Link } from "@/i18n/routing";
import {
  GUIDE_LOCALES,
  GUIDE_SLUGS,
  getGuideDocument,
  getGuideDocuments,
  getGuideHub,
  isGuideLocale,
  isGuideSlug,
} from "@/lib/guides";
import { absoluteUrl, localizedAlternates, localizedUrl } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDE_LOCALES.flatMap((locale) =>
    GUIDE_SLUGS.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isGuideLocale(locale) || !isGuideSlug(slug)) notFound();

  const guide = getGuideDocument(locale, slug);
  const pathname = `/guide/${guide.slug}`;

  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    alternates: localizedAlternates(locale, pathname),
    openGraph: {
      title: `${guide.metaTitle} | ottline`,
      description: guide.metaDescription,
      url: localizedUrl(locale, pathname),
      locale: locale === "ko" ? "ko_KR" : "en_US",
      alternateLocale: locale === "ko" ? ["en_US"] : ["ko_KR"],
      type: "article",
      modifiedTime: guide.updatedAt,
      images: [
        {
          url: absoluteUrl(guide.image.src),
          width: guide.image.width,
          height: guide.image.height,
          alt: guide.image.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${guide.metaTitle} | ottline`,
      description: guide.metaDescription,
      images: [absoluteUrl(guide.image.src)],
    },
  };
}

export default async function GuideArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isGuideLocale(locale) || !isGuideSlug(slug)) notFound();
  setRequestLocale(locale);

  const hub = getGuideHub(locale);
  const guide = getGuideDocument(locale, slug);
  const relatedGuides = getGuideDocuments(locale).filter(
    (candidate) => candidate.slug !== guide.slug,
  );

  return (
    <div className="mx-auto max-w-4xl py-4 sm:py-8">
      <nav aria-label={locale === "ko" ? "가이드 경로" : "Guide breadcrumb"}>
        <Link
          href="/guide"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-brand-navy underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          <span>{hub.metaTitle}</span>
        </Link>
      </nav>

      <article className="mt-7">
        <header className="max-w-3xl space-y-4">
          <p className="text-sm font-semibold text-brand-navy dark:text-foreground">
            {guide.eyebrow}
          </p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {guide.title}
          </h1>
          <p className="text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            {guide.summary}
          </p>
          <time
            dateTime={guide.updatedAt}
            className="block text-sm text-muted-foreground"
          >
            {guide.updatedLabel}
          </time>
        </header>

        <figure className="mt-10 overflow-hidden rounded-lg border border-border bg-card p-3 sm:p-5">
          <Image
            src={guide.image.src}
            alt={guide.image.alt}
            width={guide.image.width}
            height={guide.image.height}
            priority
            sizes="(max-width: 767px) 100vw, 640px"
            className="mx-auto max-h-[640px] w-auto rounded-lg border border-border object-contain object-top"
          />
          <figcaption className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {guide.image.caption}
          </figcaption>
        </figure>

        <div className="mx-auto mt-12 max-w-3xl space-y-12">
          {guide.sections.map((section) => (
            <section key={section.title} className="space-y-4">
              <h2 className="text-2xl font-semibold leading-snug">
                {section.title}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-base leading-8 text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
              {section.items ? (
                section.ordered ? (
                  <ol className="grid gap-3 pt-2 sm:grid-cols-3">
                    {section.items.map((item, index) => (
                      <li
                        key={item.title}
                        className="rounded-lg border border-border bg-card p-4"
                      >
                        <span className="text-sm font-semibold text-brand-navy dark:text-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <h3 className="mt-2 font-semibold">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {item.description}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <ul className="grid gap-3 pt-2 sm:grid-cols-3">
                    {section.items.map((item) => (
                      <li
                        key={item.title}
                        className="rounded-lg border border-border bg-card p-4"
                      >
                        <h3 className="font-semibold text-brand-navy dark:text-foreground">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {item.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </section>
          ))}

          <section className="rounded-lg border border-border bg-card p-6 sm:p-8">
            <h2 className="text-2xl font-semibold leading-snug">
              {guide.cta.title}
            </h2>
            <p className="mt-2 text-base leading-7 text-muted-foreground">
              {guide.cta.description}
            </p>
            <div className="mt-5">
              <GuideCtaLink
                guideSlug={guide.slug}
                contentType={guide.contentType}
                label={guide.cta.label}
              />
            </div>
          </section>

          <aside aria-labelledby="related-guides-title" className="space-y-4">
            <h2 id="related-guides-title" className="text-xl font-semibold">
              {locale === "ko" ? "다른 기록 안내" : "Explore another guide"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedGuides.map((relatedGuide) => (
                <Link
                  key={relatedGuide.slug}
                  href={`/guide/${relatedGuide.slug}`}
                  className="group rounded-lg border border-border bg-card p-5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <h3 className="font-semibold leading-snug text-brand-navy group-hover:underline dark:text-foreground">
                    {relatedGuide.cardTitle}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {relatedGuide.cardDescription}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-navy dark:text-foreground">
                    {hub.cardLabel}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </span>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
}
