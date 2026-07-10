"use client";

import { BookOpen, Film, Search, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import type { DiscussionListItem, Status, TitleSearchItem } from "@/lib/types";
import { cn, tmdbResize } from "@/lib/utils";

type ActivationContentType = "video" | "book";

type VideoDiscussionItem = {
  item: DiscussionListItem;
  source: "activation_recent_discussion";
};

type VideoPopularItem = {
  item: TitleSearchItem;
  source: "activation_popular_title";
};

function fromDiscussion(item: DiscussionListItem): TitleSearchItem {
  return {
    provider: item.titleProvider ?? "LOCAL",
    providerId: item.titleProviderId ?? item.titleId,
    titleId: item.titleId,
    type: item.titleType,
    name: item.titleName,
    year: item.titleYear,
    posterUrl: item.posterUrl,
  };
}

function typeLabel(
  item: TitleSearchItem,
  t: ReturnType<typeof useTranslations>,
) {
  if (item.type === "movie") return t("typeMovie");
  if (item.type === "series") return t("typeSeries");
  return t("typeBook");
}

function PosterRail({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: Array<VideoDiscussionItem | VideoPopularItem>;
  onSelect: (
    item: TitleSearchItem,
    source: VideoDiscussionItem["source"] | VideoPopularItem["source"],
  ) => void;
}) {
  const t = useTranslations("FirstLogActivation");
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground">{title}</div>
      <div className="grid auto-cols-[116px] grid-flow-col gap-3 overflow-x-auto pb-1 sm:grid-flow-row sm:grid-cols-3 sm:overflow-visible sm:pb-0 lg:grid-cols-4">
        {items.map(({ item, source }) => {
          const titleItem =
            source === "activation_recent_discussion"
              ? fromDiscussion(item as DiscussionListItem)
              : (item as TitleSearchItem);
          const key =
            source === "activation_recent_discussion"
              ? `discussion:${(item as DiscussionListItem).id}`
              : `popular:${titleItem.provider}:${titleItem.providerId}`;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(titleItem, source)}
              className="group min-w-0 rounded-lg border border-border bg-card text-left transition-colors hover:border-muted-foreground/30 hover:bg-ott-paper-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <div className="aspect-[2/3] w-full overflow-hidden rounded-t-lg bg-muted">
                {titleItem.posterUrl ? (
                  <Image
                    src={
                      tmdbResize(titleItem.posterUrl, "w185") ??
                      titleItem.posterUrl
                    }
                    alt={titleItem.name}
                    width={116}
                    height={174}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>
              <div className="space-y-1 p-2">
                <div className="line-clamp-2 min-h-10 text-xs font-semibold leading-5 text-foreground">
                  {titleItem.name}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {typeLabel(titleItem, t)}
                  {titleItem.year ? ` · ${titleItem.year}` : ""}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FirstLogActivationPanel({
  contentType,
  recentVideoItems,
  popularVideoItems,
  onContentTypeChange,
  onDismiss,
  onVideoSelect,
  onBookStatusSelect,
  onFindOther,
  loading = false,
}: {
  contentType: ActivationContentType;
  recentVideoItems: DiscussionListItem[];
  popularVideoItems: TitleSearchItem[];
  onContentTypeChange: (type: ActivationContentType) => void;
  onDismiss: () => void;
  onVideoSelect: (
    item: TitleSearchItem,
    source: "activation_recent_discussion" | "activation_popular_title",
  ) => void;
  onBookStatusSelect: (status: Status) => void;
  onFindOther: (type: ActivationContentType) => void;
  loading?: boolean;
}) {
  const t = useTranslations("FirstLogActivation");

  useEffect(() => {
    void trackEvent("activation_impression", {
      defaultContentType: "video",
    });
  }, []);

  const recentItems: VideoDiscussionItem[] = recentVideoItems.map((item) => ({
    item,
    source: "activation_recent_discussion",
  }));
  const popularItems: VideoPopularItem[] = popularVideoItems.map((item) => ({
    item,
    source: "activation_popular_title",
  }));
  const hasVideoItems = recentItems.length > 0 || popularItems.length > 0;

  function selectType(type: ActivationContentType) {
    onContentTypeChange(type);
    void trackEvent("activation_content_type_select", {
      contentType: type,
    });
  }

  function selectBookStatus(status: Status) {
    void trackEvent("activation_status_select", {
      contentType: "book",
      status,
    });
    onBookStatusSelect(status);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">
            {t("eyebrow")}
          </div>
          <h2 className="text-xl font-semibold leading-tight text-foreground">
            {t("title")}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-ott-paper-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label={t("closeLabel")}
          title={t("closeLabel")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => selectType("video")}
          aria-pressed={contentType === "video"}
          className={cn(
            "flex min-h-14 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors",
            contentType === "video"
              ? "border-[#1E4D8C]/40 bg-ott-paper-strong text-[#1E4D8C] shadow-sm ring-1 ring-[#1E4D8C]/15 dark:border-border dark:text-foreground dark:ring-border"
              : "border-border bg-card text-muted-foreground hover:bg-ott-paper-strong hover:text-foreground",
          )}
        >
          <Film className="h-4 w-4" />
          {t("tabVideo")}
        </button>
        <button
          type="button"
          onClick={() => selectType("book")}
          aria-pressed={contentType === "book"}
          className={cn(
            "flex min-h-14 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors",
            contentType === "book"
              ? "border-[#1E4D8C]/40 bg-ott-paper-strong text-[#1E4D8C] shadow-sm ring-1 ring-[#1E4D8C]/15 dark:border-border dark:text-foreground dark:ring-border"
              : "border-border bg-card text-muted-foreground hover:bg-ott-paper-strong hover:text-foreground",
          )}
        >
          <BookOpen className="h-4 w-4" />
          {t("tabBook")}
        </button>
      </div>

      {contentType === "video" ? (
        <div className="mt-5 space-y-4">
          <div className="space-y-1">
            <div className="text-base font-semibold text-foreground">
              {t("videoTitle")}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {t("videoDescription")}
            </p>
          </div>
          {loading ? (
            <div className="grid auto-cols-[116px] grid-flow-col gap-3 overflow-hidden pb-1 sm:grid-flow-row sm:grid-cols-3 sm:pb-0 lg:grid-cols-4">
              {[
                "activation-skeleton-1",
                "activation-skeleton-2",
                "activation-skeleton-3",
                "activation-skeleton-4",
              ].map((key) => (
                <div
                  key={key}
                  className="rounded-lg border border-border bg-card"
                  aria-hidden="true"
                >
                  <div className="aspect-[2/3] animate-pulse rounded-t-lg bg-muted" />
                  <div className="space-y-2 p-2">
                    <div className="h-3 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : hasVideoItems ? (
            <>
              <PosterRail
                title={t("recentSection")}
                items={recentItems}
                onSelect={onVideoSelect}
              />
              <PosterRail
                title={t("popularSection")}
                items={popularItems}
                onSelect={onVideoSelect}
              />
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-ott-paper p-4 text-sm text-muted-foreground">
              {t("videoEmpty")}
            </div>
          )}
          <button
            type="button"
            onClick={() => onFindOther("video")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-[#1E4D8C] transition-colors hover:bg-ott-paper-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:text-foreground"
          >
            <Search className="h-4 w-4" />
            {t("findOtherVideo")}
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="space-y-1">
            <div className="text-base font-semibold text-foreground">
              {t("bookTitle")}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {t("bookDescription")}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => selectBookStatus("IN_PROGRESS")}
              className="min-h-12 rounded-lg border border-border bg-ott-paper px-3 text-sm font-semibold text-foreground transition-colors hover:bg-ott-paper-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {t("bookStatusInProgress")}
            </button>
            <button
              type="button"
              onClick={() => selectBookStatus("DONE")}
              className="min-h-12 rounded-lg border border-border bg-ott-paper px-3 text-sm font-semibold text-foreground transition-colors hover:bg-ott-paper-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {t("bookStatusDone")}
            </button>
            <button
              type="button"
              onClick={() => selectBookStatus("WISHLIST")}
              className="min-h-12 rounded-lg border border-border bg-ott-paper px-3 text-sm font-semibold text-foreground transition-colors hover:bg-ott-paper-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {t("bookStatusWishlist")}
            </button>
          </div>
          <button
            type="button"
            onClick={() => onFindOther("book")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-[#1E4D8C] transition-colors hover:bg-ott-paper-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:text-foreground"
          >
            <Search className="h-4 w-4" />
            {t("bookSearchAction")}
          </button>
        </div>
      )}
    </section>
  );
}
