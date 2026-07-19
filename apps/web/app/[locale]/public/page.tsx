import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import PublicDiscussionsClient from "@/components/PublicDiscussionsClient";
import { localizedAlternates, localizedOpenGraph } from "@/lib/seo";
import type { DiscussionListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
};

async function loadPublicDiscussions(locale: string): Promise<{
  items: DiscussionListItem[];
  failed: boolean;
}> {
  const backendUrl = process.env.BACKEND_URL?.replace(/\/+$/, "");
  if (!backendUrl) return { items: [], failed: true };

  try {
    const response = await fetch(
      `${backendUrl}/api/discussions/all?limit=100`,
      {
        headers: { "Accept-Language": locale },
        cache: "no-store",
      },
    );
    if (!response.ok) return { items: [], failed: true };

    return {
      items: (await response.json()) as DiscussionListItem[],
      failed: false,
    };
  } catch {
    return { items: [], failed: true };
  }
}

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

export default async function PublicDiscussionsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Public" });
  const { items, failed } = await loadPublicDiscussions(locale);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          {t("title")}
        </h1>
      </header>

      <PublicDiscussionsClient initialItems={items} initialFailed={failed} />
    </div>
  );
}
