import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import CuratedContentList from "@/components/CuratedContentList";
import PublicDiscussionsClient from "@/components/PublicDiscussionsClient";
import { localizedAlternates, localizedOpenGraph } from "@/lib/seo";
import type { CuratedContent, DiscussionListItem } from "@/lib/types";

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

async function loadCuratedContents(locale: string): Promise<CuratedContent[]> {
  const backendUrl = process.env.BACKEND_URL?.replace(/\/+$/, "");
  if (!backendUrl) return [];

  try {
    const response = await fetch(`${backendUrl}/api/curated-contents?limit=6`, {
      headers: { "Accept-Language": locale },
      cache: "no-store",
    });
    if (!response.ok) return [];
    return (await response.json()) as CuratedContent[];
  } catch {
    return [];
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
  const [{ items, failed }, curatedItems] = await Promise.all([
    loadPublicDiscussions(locale),
    loadCuratedContents(locale),
  ]);

  return (
    <div className="v2-secondary-page space-y-6">
      <header className="v2-page-heading">
        <p className="v2-eyebrow">
          {locale === "ko" ? "함께 나누는 이야기" : "STORIES, SHARED"}
        </p>
        <h1>
          {locale === "ko"
            ? "같은 이야기, 다른 마음"
            : "Same story, different feelings"}
        </h1>
        <p className="v2-page-lead">
          {locale === "ko"
            ? "같은 작품에서 만난 장면과 생각을 함께 나눠요."
            : "Share the scenes and thoughts that stayed with you."}
        </p>
      </header>

      <CuratedContentList items={curatedItems} />
      <PublicDiscussionsClient initialItems={items} initialFailed={failed} />
    </div>
  );
}
