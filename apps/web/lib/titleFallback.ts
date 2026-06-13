import type { DiscussionListItem, TitleSearchItem } from "@/lib/types";

function titleFallbackKey({
  type,
  name,
  year,
}: {
  type: string;
  name: string;
  year?: number | null;
}) {
  return `${type}:${name.trim().toLowerCase()}:${year ?? ""}`;
}

export function selectPopularTitleFillers(
  discussions: DiscussionListItem[],
  trends: TitleSearchItem[],
  limit: number,
) {
  const providerKeys = new Set(
    discussions
      .map((item) =>
        item.titleProvider && item.titleProviderId
          ? `${item.titleProvider}:${item.titleProviderId}`
          : null,
      )
      .filter((key): key is string => Boolean(key)),
  );
  const fallbackKeys = new Set(
    discussions.map((item) =>
      titleFallbackKey({
        type: item.titleType,
        name: item.titleName,
        year: item.titleYear,
      }),
    ),
  );
  const selected: TitleSearchItem[] = [];

  for (const item of trends) {
    if (selected.length >= limit) break;
    const providerKey = `${item.provider}:${item.providerId}`;
    const fallbackKey = titleFallbackKey(item);
    if (providerKeys.has(providerKey) || fallbackKeys.has(fallbackKey)) {
      continue;
    }
    providerKeys.add(providerKey);
    fallbackKeys.add(fallbackKey);
    selected.push(item);
  }

  return selected;
}
