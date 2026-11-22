import type { ReactNode } from "react";
import PublicDiscussionsClient from "@/components/PublicDiscussionsClient";
import type { DiscussionListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

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
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) return { items: [], failed: true };
    return { items: await response.json(), failed: false };
  } catch {
    return { items: [], failed: true };
  }
}

export default async function PublicLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { items, failed } = await loadPublicDiscussions(locale);

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
      <PublicDiscussionsClient initialItems={items} initialFailed={failed}>
        {children}
      </PublicDiscussionsClient>
    </div>
  );
}
