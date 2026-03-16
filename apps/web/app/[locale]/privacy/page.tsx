import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Privacy" });

  return {
    title: t("title"),
    alternates: { canonical: "https://ottline.app/privacy" },
    openGraph: {
      title: `${t("title")} | ottline`,
      url: "https://ottline.app/privacy",
    },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Privacy" });

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-10">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lastUpdated")}</p>
      </section>

      <section className="space-y-6">
        <p className="text-sm leading-relaxed text-neutral-700">{t("intro")}</p>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("section1Title")}</h2>
          <ul
            className="list-inside list-disc space-y-1 text-sm text-neutral-700"
            dangerouslySetInnerHTML={{ __html: t.raw("section1List") as string }}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("section2Title")}</h2>
          <ul
            className="list-inside list-disc space-y-1 text-sm text-neutral-700"
            dangerouslySetInnerHTML={{ __html: t.raw("section2List") as string }}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("section3Title")}</h2>
          <ul
            className="list-inside list-disc space-y-1 text-sm text-neutral-700"
            dangerouslySetInnerHTML={{ __html: t.raw("section3List") as string }}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("section4Title")}</h2>
          <p className="text-sm leading-relaxed text-neutral-700">{t("section4Desc")}</p>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("section5Title")}</h2>
          <p className="text-sm leading-relaxed text-neutral-700">{t("section5Desc")}</p>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("section6Title")}</h2>
          <p className="text-sm leading-relaxed text-neutral-700">{t("section6Desc")}</p>
        </div>
      </section>
    </div>
  );
}
