import type { DiscussionListItem, Provider, Title, TitleSearchItem } from './types';

function normalizeProvider(value: DiscussionListItem['titleProvider']): Provider | undefined {
  return value === 'TMDB' || value === 'LOCAL' || value === 'NAVER' || value === 'KAKAO'
    ? value
    : undefined;
}

export function titleFromSearch(item: TitleSearchItem, id: string): Title {
  return {
    id,
    type: item.type,
    name: item.name,
    year: item.year ?? null,
    posterUrl: item.posterUrl ?? null,
    overview: item.overview ?? null,
    author: item.author ?? null,
    publisher: item.publisher ?? null,
    isbn10: item.isbn10 ?? null,
    isbn13: item.isbn13 ?? null,
    pubdate: item.pubdate ?? null,
    provider: item.provider,
    providerId: item.providerId,
  };
}

export function searchItemFromDiscussion(item: DiscussionListItem): TitleSearchItem {
  return {
    provider: normalizeProvider(item.titleProvider) ?? 'LOCAL',
    providerId: item.titleProviderId ?? item.titleId,
    titleId: item.titleId,
    type: item.titleType,
    name: item.titleName,
    year: item.titleYear ?? null,
    posterUrl: item.posterUrl ?? null,
  };
}

export function titleFromDiscussion(item: DiscussionListItem): Title {
  return {
    id: item.titleId,
    type: item.titleType,
    name: item.titleName,
    year: item.titleYear ?? null,
    posterUrl: item.posterUrl ?? null,
    provider: normalizeProvider(item.titleProvider),
    providerId: item.titleProviderId ?? undefined,
  };
}
