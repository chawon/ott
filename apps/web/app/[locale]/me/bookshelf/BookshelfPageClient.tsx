"use client";

import { BookOpen, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BookshelfCover from "@/components/BookshelfCover";
import { Link as IntlLink } from "@/i18n/routing";
import { trackEvent } from "@/lib/analytics";
import {
  type Bookshelf,
  type BookshelfBook,
  buildBookshelf,
  type KdcMajor,
  normalizeBookIsbn13,
} from "@/lib/bookshelf";
import {
  getCachedClassificationsForLogs,
  resolveBookClassifications,
} from "@/lib/bookshelfStore";
import { listAllLogsLocal } from "@/lib/localStore";
import { isProfileComplete } from "@/lib/profile";
import type { WatchLog } from "@/lib/types";
import { useUserProfile } from "@/lib/useUserProfile";
import { cn, statusLabel } from "@/lib/utils";

const SHELF_SKELETON_IDS = [
  "shelf-0",
  "shelf-1",
  "shelf-2",
  "shelf-3",
  "shelf-4",
  "shelf-5",
  "shelf-6",
  "shelf-7",
  "shelf-8",
  "shelf-9",
] as const;

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function bookIsbns(logs: WatchLog[]) {
  return Array.from(
    new Set(
      logs
        .filter((log) => log.title?.type === "book" && !log.deletedAt)
        .map((log) => normalizeBookIsbn13(log.title))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export default function BookshelfPageClient({
  initialKdc,
}: {
  initialKdc: KdcMajor | null;
}) {
  const t = useTranslations("Bookshelf");
  const tStatus = useTranslations("Status");
  const locale = useLocale();
  const { profile } = useUserProfile();
  const [logs, setLogs] = useState<WatchLog[]>([]);
  const [shelf, setShelf] = useState<Bookshelf | null>(null);
  const [selectedMajor, setSelectedMajor] = useState<KdcMajor | null>(
    initialKdc,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [classificationError, setClassificationError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const detailRef = useRef<HTMLElement | null>(null);
  const openTracked = useRef(false);

  const renderFromLocal = useCallback(async (nextLogs?: WatchLog[]) => {
    const items = nextLogs ?? (await listAllLogsLocal());
    const classifications = await getCachedClassificationsForLogs(items);
    setLogs(items);
    setShelf(buildBookshelf(items, classifications));
    return items;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const items = await renderFromLocal();
      const isbns = bookIsbns(items);
      if (isbns.length > 0) {
        try {
          const classifications = await resolveBookClassifications(isbns);
          setShelf(buildBookshelf(items, classifications));
          setClassificationError(false);
        } catch {
          setClassificationError(true);
        }
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [renderFromLocal]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refreshLocal = () => {
      void renderFromLocal();
    };
    window.addEventListener("sync:updated", refreshLocal);
    window.addEventListener("bookshelf:updated", refreshLocal);
    return () => {
      window.removeEventListener("sync:updated", refreshLocal);
      window.removeEventListener("bookshelf:updated", refreshLocal);
    };
  }, [renderFromLocal]);

  useEffect(() => {
    if (!shelf) return;
    setSelectedMajor((current) => {
      if (current !== null) return current;
      return (
        shelf.groups.find((group) => group.books.length > 0)?.major ?? null
      );
    });
    if (!openTracked.current) {
      openTracked.current = true;
      void trackEvent("bookshelf_open", {
        totalBooks: shelf.books.length,
        classifiedBooks: shelf.books.length - shelf.unclassifiedBooks.length,
        unclassifiedBooks: shelf.unclassifiedBooks.length,
        categoryCount: shelf.categoryCount,
      });
    }
  }, [shelf]);

  const selectedGroup = useMemo(
    () =>
      selectedMajor === null
        ? null
        : (shelf?.groups.find((group) => group.major === selectedMajor) ??
          null),
    [selectedMajor, shelf],
  );

  function categoryName(major: KdcMajor) {
    return t(`categories.${major}`);
  }

  function selectCategory(major: KdcMajor, scroll = true) {
    setSelectedMajor(major);
    const group = shelf?.groups.find((item) => item.major === major);
    void trackEvent("bookshelf_category_open", {
      kdcMajor: major,
      bookCount: group?.books.length ?? 0,
    });
    if (!scroll) return;
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      detailRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  async function retryClassifications() {
    const isbns = bookIsbns(logs);
    if (isbns.length === 0 || retrying) return;
    setRetrying(true);
    try {
      const classifications = await resolveBookClassifications(isbns, {
        forceNotFound: true,
      });
      setShelf(buildBookshelf(logs, classifications));
      setClassificationError(false);
    } catch {
      setClassificationError(true);
    } finally {
      setRetrying(false);
    }
  }

  if (loading && !shelf) {
    return (
      <div className="space-y-4" aria-live="polite">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
        <div className="h-36 animate-pulse rounded-lg bg-[#ECEBE9] motion-reduce:animate-none dark:bg-[#2B241F]" />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-5">
          {SHELF_SKELETON_IDS.map((id) => (
            <div
              key={id}
              className="h-28 animate-pulse bg-card motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>
    );
  }

  if (loadError || !shelf) {
    return (
      <section className="rounded-lg border border-border bg-[#FEF9EE] p-6 text-center dark:bg-[#2B241F]">
        <h1 className="text-xl font-semibold text-foreground">
          {t("loadErrorTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("loadErrorDesc")}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-lg border border-[#1E4D8C]/40 bg-card px-5 text-sm font-semibold text-[#1E4D8C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/50 dark:text-foreground"
        >
          {t("reopen")}
        </button>
      </section>
    );
  }

  const profileComplete = isProfileComplete(profile);
  const pageTitle = profileComplete
    ? t("personalizedTitle", { nickname: profile?.nickname ?? "" })
    : t("title");

  if (shelf.books.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
            {pageTitle}
          </h1>
        </header>
        <section className="rounded-lg border border-border bg-[#FEF9EE] p-6 text-center dark:bg-[#2B241F] sm:p-10">
          <div className="mx-auto flex h-28 max-w-sm items-end justify-center border-b-2 border-[#ECEBE9] dark:border-border">
            <BookOpen
              className="mb-6 h-8 w-8 text-[#4A4A4A] dark:text-[#D8CFC4]"
              aria-hidden="true"
            />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-foreground">
            {t("emptyTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {t("emptyDesc")}
          </p>
          <IntlLink
            href="/?quick=1&quick_type=book&quick_focus=1"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-[#FF9933] px-6 text-base font-semibold text-[#0F0F0F] transition-colors hover:bg-[#FF9933]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/50"
          >
            {t("emptyAction")}
          </IntlLink>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-foreground">
            {pageTitle}
          </h1>
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">
            {t("headline")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t("subhead")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-lg bg-[#FAF5D7] px-2 py-1 font-semibold text-[#4A4A4A] dark:bg-muted dark:text-[#D8CFC4]">
            {t("kdcBadge")}
          </span>
          <span>{t("kdcExplainer")}</span>
        </div>
      </header>

      <section aria-labelledby="shelves-title" className="space-y-4">
        <div>
          <h2
            id="shelves-title"
            className="text-xl font-semibold text-foreground"
          >
            {t("categoriesTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("summary", {
              count: shelf.books.length,
              categoryCount: shelf.categoryCount,
            })}
          </p>
        </div>

        <fieldset className="grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-5">
          <legend className="sr-only">{t("categoriesTitle")}</legend>
          {shelf.groups.map((group) => {
            const selected = selectedMajor === group.major;
            const name = categoryName(group.major);
            return (
              <button
                key={group.major}
                type="button"
                aria-pressed={selected}
                aria-controls="selected-bookshelf"
                aria-label={
                  group.books.length > 0
                    ? t("categoryOpenLabel", {
                        category: name,
                        count: group.books.length,
                      })
                    : t("emptyCategoryLabel", { category: name })
                }
                onClick={() => selectCategory(group.major)}
                className={cn(
                  "relative flex min-h-32 flex-col bg-card p-3 text-left transition-colors duration-150 hover:bg-[#FEF9EE] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FF9933] dark:hover:bg-[#2B241F]",
                  selected &&
                    "z-[1] bg-[#FEF9EE] ring-2 ring-inset ring-[#1E4D8C] dark:bg-[#2B241F] dark:ring-foreground",
                )}
              >
                <span className="text-xs font-semibold text-[#1E4D8C] dark:text-foreground">
                  {group.code}
                </span>
                <span className="mt-0.5 text-sm font-semibold text-foreground">
                  {name}
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {group.books.length > 0
                    ? t("bookCount", { count: group.books.length })
                    : " "}
                </span>
                <span className="mt-auto flex h-11 items-end gap-1 border-b-2 border-[#ECEBE9] dark:border-border">
                  {group.books.slice(0, 3).map((book, index) => (
                    <BookshelfCover
                      key={book.key}
                      title={book.title}
                      decorative
                      className={cn("w-7", index === 1 ? "h-10" : "h-9")}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </fieldset>
      </section>

      {selectedGroup ? (
        <section
          ref={detailRef}
          id="selected-bookshelf"
          className="scroll-mt-24 space-y-4"
          aria-live="polite"
        >
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {t("selectedTitle", {
                category: categoryName(selectedGroup.major),
              })}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedGroup.books.length > 0
                ? t("selectedCount", { count: selectedGroup.books.length })
                : t("emptyCategory")}
            </p>
          </div>
          {selectedGroup.books.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {selectedGroup.books.map((book) => (
                <ShelfBookCard
                  key={book.key}
                  book={book}
                  status={statusLabel(book.status, "book", tStatus)}
                  savedDate={t("savedDate", {
                    date: formatDate(book.loggedAt, locale),
                  })}
                />
              ))}
            </div>
          ) : (
            <div className="h-16 border-b-2 border-[#ECEBE9] dark:border-border" />
          )}
        </section>
      ) : null}

      {shelf.unclassifiedBooks.length > 0 ? (
        <section className="rounded-lg border border-border bg-[#FEF9EE] p-4 dark:bg-[#2B241F]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {t("waitingTitle")} · {shelf.unclassifiedBooks.length}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {classificationError ? t("loadErrorDesc") : t("waitingDesc")}
              </p>
            </div>
            {shelf.unclassifiedBooks.some((book) => book.isbn13) ? (
              <button
                type="button"
                onClick={() => void retryClassifications()}
                disabled={retrying}
                className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-[#1E4D8C]/40 bg-card px-4 text-sm font-semibold text-[#1E4D8C] transition-colors hover:bg-[#FEF9EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/50 disabled:opacity-50 dark:text-foreground dark:hover:bg-[#2B241F]"
              >
                <RefreshCw
                  className={cn("h-4 w-4", retrying && "animate-spin")}
                  aria-hidden="true"
                />
                {retrying ? t("retrying") : t("retry")}
              </button>
            ) : null}
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto border-b-2 border-[#ECEBE9] pb-2 no-scrollbar dark:border-border">
            {shelf.unclassifiedBooks.map((book) => (
              <BookshelfCover
                key={book.key}
                title={book.title}
                className="h-24 w-16 shrink-0"
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ShelfBookCard({
  book,
  status,
  savedDate,
}: {
  book: BookshelfBook;
  status: string;
  savedDate: string;
}) {
  return (
    <IntlLink
      href={`/title/${book.title.id}`}
      className="group rounded-lg border border-border bg-card p-3 shadow-sm transition-colors hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/50"
    >
      <BookshelfCover title={book.title} className="aspect-[2/3] w-full" />
      <h3 className="mt-3 line-clamp-2 text-base font-semibold text-foreground group-hover:underline">
        {book.title.name}
      </h3>
      {book.title.author ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {book.title.author}
        </p>
      ) : null}
      <p className="mt-2 text-xs font-medium text-[#1E4D8C] dark:text-foreground">
        {status}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{savedDate}</p>
    </IntlLink>
  );
}
