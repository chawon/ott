import type { Metadata } from "next";

import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
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

import { useTranslations } from "next-intl";
export default function AboutPage() {
  const tAbout = useTranslations("About");
  return (
    <div className="mx-auto max-w-2xl space-y-10 py-10 text-foreground">
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">
          {tAbout("subtitle")}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {tAbout("description")}
        </p>
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
                  <img
                    src="/og/share-card?sample=video"
                    alt={tAbout("exampleVideo")}
                    className="w-full rounded-2xl border border-border bg-muted/40"
                    loading="lazy"
                  />
                  <figcaption className="text-xs text-muted-foreground">
                    {tAbout("exampleVideo")}
                  </figcaption>
                </figure>
                <figure className="space-y-2">
                  <img
                    src="/og/share-card?sample=book"
                    alt={tAbout("exampleBook")}
                    className="w-full rounded-2xl border border-border bg-muted/40"
                    loading="lazy"
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
