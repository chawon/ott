import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "FAQ" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: "https://ottline.app/faq" },
    openGraph: {
      title: `${t("title")} | ottline`,
      description: t("description"),
      url: "https://ottline.app/faq",
    },
  };
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "FAQ" });

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "");

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: t("heading"),
    url: "https://ottline.app/faq",
    inLanguage: locale === "ko" ? "ko-KR" : "en-US",
    mainEntity: [
      { "@type": "Question", name: stripHtml(t("q1")), acceptedAnswer: { "@type": "Answer", text: stripHtml(t.raw("a1") as string) } },
      { "@type": "Question", name: stripHtml(t("q2")), acceptedAnswer: { "@type": "Answer", text: stripHtml(t.raw("a2") as string) } },
      { "@type": "Question", name: stripHtml(t("q3")), acceptedAnswer: { "@type": "Answer", text: stripHtml(t.raw("a3") as string) } },
      { "@type": "Question", name: stripHtml(t("q4")), acceptedAnswer: { "@type": "Answer", text: stripHtml(t.raw("a4") as string) } },
      { "@type": "Question", name: stripHtml(t("q5")), acceptedAnswer: { "@type": "Answer", text: stripHtml(t.raw("a5") as string) } },
      { "@type": "Question", name: stripHtml(t("q6")), acceptedAnswer: { "@type": "Answer", text: stripHtml(t.raw("a6") as string) } },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="mx-auto max-w-2xl space-y-8 py-10">
        <section className="space-y-2">
          <h1 className="text-xl font-semibold">{t("heading")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </section>

        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-bold">{t("q1")}</h2>
            <p
              className="text-sm leading-relaxed text-neutral-700"
              dangerouslySetInnerHTML={{ __html: t.raw("a1") as string }}
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold">{t("q2")}</h2>
            <p
              className="text-sm leading-relaxed text-neutral-700"
              dangerouslySetInnerHTML={{ __html: t.raw("a2") as string }}
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold">{t("q3")}</h2>
            <p
              className="text-sm leading-relaxed text-neutral-700"
              dangerouslySetInnerHTML={{ __html: t.raw("a3") as string }}
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold">{t("q4")}</h2>
            <p
              className="text-sm leading-relaxed text-neutral-700"
              dangerouslySetInnerHTML={{ __html: t.raw("a4") as string }}
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold">{t("q5")}</h2>
            <p
              className="text-sm leading-relaxed text-neutral-700"
              dangerouslySetInnerHTML={{ __html: t.raw("a5") as string }}
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold">{t("q6")}</h2>
            <p
              className="text-sm leading-relaxed text-neutral-700"
              dangerouslySetInnerHTML={{ __html: t.raw("a6") as string }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
