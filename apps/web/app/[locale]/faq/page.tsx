"use client";

import { useTranslations } from "next-intl";

export default function FaqPage() {
  const t = useTranslations("FAQ");
  return (
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
            dangerouslySetInnerHTML={{ __html: t.raw("a1") }}
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold">{t("q2")}</h2>
          <p
            className="text-sm leading-relaxed text-neutral-700"
            dangerouslySetInnerHTML={{ __html: t.raw("a2") }}
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold">{t("q3")}</h2>
          <p
            className="text-sm leading-relaxed text-neutral-700"
            dangerouslySetInnerHTML={{ __html: t.raw("a3") }}
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold">{t("q4")}</h2>
          <p
            className="text-sm leading-relaxed text-neutral-700"
            dangerouslySetInnerHTML={{ __html: t.raw("a4") }}
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold">{t("q5")}</h2>
          <p
            className="text-sm leading-relaxed text-neutral-700"
            dangerouslySetInnerHTML={{ __html: t.raw("a5") }}
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold">{t("q6")}</h2>
          <p
            className="text-sm leading-relaxed text-neutral-700"
            dangerouslySetInnerHTML={{ __html: t.raw("a6") }}
          />
        </div>
      </div>
    </div>
  );
}
