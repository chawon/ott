import type { Metadata } from "next";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Link as IntlLink } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: "https://ottline.app/about",
      languages: {
        ko: "https://ottline.app/ko/about",
        en: "https://ottline.app/en/about",
      },
    },
    openGraph: {
      title: `${t("title")} | ottline`,
      description: t("description"),
      url: "https://ottline.app/about",
    },
  };
}

export default function AboutPage() {
  const tAbout = useTranslations("About");
  const platforms = [
    {
      title: tAbout("platformWebTitle"),
      description: tAbout("platformWebDesc"),
      href: "/",
      linkLabel: tAbout("platformWebLink"),
      external: false,
    },
    {
      title: tAbout("platformTossTitle"),
      description: tAbout("platformTossDesc"),
      href: "https://minion.toss.im/XYvjpUB2",
      linkLabel: tAbout("platformTossLink"),
      external: true,
    },
    {
      title: tAbout("platformExtensionTitle"),
      description: tAbout("platformExtensionDesc"),
      href: "https://chromewebstore.google.com/detail/achangjgnpbideilpolbohbkmmkmojpo",
      linkLabel: tAbout("platformExtensionLink"),
      external: true,
    },
    {
      title: tAbout("platformWindowsTitle"),
      description: tAbout("platformWindowsDesc"),
      href: "https://apps.microsoft.com/detail/9nsvnzgdmgf5",
      linkLabel: tAbout("platformWindowsLink"),
      external: true,
    },
    {
      title: tAbout("platformAndroidTitle"),
      description: tAbout("platformAndroidDesc"),
      status: tAbout("platformPreparing"),
    },
    {
      title: tAbout("platformChatGptTitle"),
      description: tAbout("platformChatGptDesc"),
      status: tAbout("platformPreparing"),
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-10 py-10 text-foreground">
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{tAbout("subtitle")}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {tAbout("description")}
        </p>
      </section>

      <section className="rounded-3xl border border-sky-200 bg-[linear-gradient(135deg,rgba(240,249,255,0.96),rgba(224,242,254,0.82))] p-6 text-slate-900">
        <h2 className="text-lg font-semibold">
          {tAbout("pairingHighlightTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          {tAbout("pairingHighlightDesc")}
        </p>
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="border-b border-border pb-2 text-xl font-semibold">
            {tAbout("platformsTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {tAbout("platformsDesc")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {platforms.map((platform, index) => (
            <article
              key={platform.title}
              className="rounded-2xl border border-border bg-muted/30 p-5"
            >
              <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </div>
              <h3 className="mt-3 font-medium">{platform.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {platform.description}
              </p>
              {platform.href ? (
                platform.external ? (
                  <a
                    href={platform.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-background"
                  >
                    {platform.linkLabel}
                  </a>
                ) : (
                  <IntlLink
                    href={platform.href}
                    className="mt-4 inline-flex items-center rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-background"
                  >
                    {platform.linkLabel}
                  </IntlLink>
                )
              ) : null}
              {platform.status ? (
                <div className="mt-4 inline-flex items-center rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900">
                  {platform.status}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="border-b border-border pb-2 text-xl font-semibold">
          {tAbout("howToUseTitle")}
        </h2>
        <div className="grid gap-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <h3 className="font-medium">{tAbout("step1Title")}</h3>
              <p className="text-sm text-muted-foreground">
                {tAbout("step1Desc")}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <h3 className="font-medium">{tAbout("step2Title")}</h3>
              <p className="text-sm text-muted-foreground">
                {tAbout("step2Desc")}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <h3 className="font-medium">{tAbout("step3Title")}</h3>
              <p className="text-sm text-muted-foreground">
                {tAbout("step3Desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="border-b border-border pb-2 text-xl font-semibold">
          {tAbout("moreTipsTitle")}
        </h2>
        <div className="grid gap-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">
              +
            </div>
            <div>
              <h3 className="font-medium">{tAbout("tip1Title")}</h3>
              <p className="text-sm text-muted-foreground">
                {tAbout("tip1Desc")}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">
              +
            </div>
            <div>
              <h3 className="font-medium">{tAbout("tip2Title")}</h3>
              <p className="text-sm text-muted-foreground">
                {tAbout("tip2Desc")}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">
              +
            </div>
            <div>
              <h3 className="font-medium">{tAbout("tip3Title")}</h3>
              <p className="text-sm text-muted-foreground">
                {tAbout("tip3Desc")}
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <figure className="space-y-2">
                  <Image
                    src="/og/share-card?sample=video"
                    alt={tAbout("exampleVideo")}
                    className="w-full rounded-2xl border border-border bg-muted/40"
                    width={1200}
                    height={630}
                  />
                  <figcaption className="text-xs text-muted-foreground">
                    {tAbout("exampleVideo")}
                  </figcaption>
                </figure>
                <figure className="space-y-2">
                  <Image
                    src="/og/share-card?sample=book"
                    alt={tAbout("exampleBook")}
                    className="w-full rounded-2xl border border-border bg-muted/40"
                    width={1200}
                    height={630}
                  />
                  <figcaption className="text-xs text-muted-foreground">
                    {tAbout("exampleBook")}
                  </figcaption>
                </figure>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-muted/60 p-6 italic text-muted-foreground">
        {tAbout("closing")}
      </section>
    </div>
  );
}
