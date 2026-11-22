import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { localizedAlternates, localizedOpenGraph } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Public" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: localizedAlternates(locale, "/public"),
    openGraph: localizedOpenGraph(
      locale,
      "/public",
      `${t("title")} | ottline`,
      t("description"),
    ),
  };
}

export default function PublicDiscussionsPage() {
  return null;
}
