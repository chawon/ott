import type { BookClassification, Status, Title, WatchLog } from "./types";

export type KdcMajor = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const KDC_MAJOR_CATEGORIES: ReadonlyArray<{
  major: KdcMajor;
  code: string;
}> = Array.from({ length: 10 }, (_, major) => ({
  major: major as KdcMajor,
  code: `${major}00`,
}));

export type BookshelfBook = {
  key: string;
  title: Title;
  status: Status;
  loggedAt: string;
  isbn13: string | null;
  classification: BookClassification | null;
};

export type BookshelfGroup = {
  major: KdcMajor;
  code: string;
  books: BookshelfBook[];
};

export type Bookshelf = {
  books: BookshelfBook[];
  groups: BookshelfGroup[];
  recentBooks: BookshelfBook[];
  unclassifiedBooks: BookshelfBook[];
  categoryCount: number;
};

export function isKdcBookshelfLocale(locale: string) {
  return locale === "ko";
}

function isbn13CheckDigit(firstTwelveDigits: string) {
  let sum = 0;
  for (let index = 0; index < firstTwelveDigits.length; index += 1) {
    const digit = Number(firstTwelveDigits[index]);
    sum += digit * (index % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

export function isValidIsbn13(value: string) {
  if (!/^\d{13}$/.test(value)) return false;
  return isbn13CheckDigit(value.slice(0, 12)) === value[12];
}

export function isValidIsbn10(value: string) {
  if (!/^\d{9}[\dX]$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    const digit = value[index] === "X" ? 10 : Number(value[index]);
    sum += digit * (10 - index);
  }
  return sum % 11 === 0;
}

export function normalizeBookIsbn13(
  title: Pick<Title, "isbn10" | "isbn13" | "provider" | "providerId">,
) {
  const providerIsbn =
    title.provider === "NAVER" ? (title.providerId ?? "") : "";
  const raw13 = [title.isbn13 ?? "", providerIsbn]
    .map((value) => value.replace(/\D/g, ""))
    .find(isValidIsbn13);
  if (raw13) return raw13;

  const raw10 = [title.isbn10 ?? "", providerIsbn]
    .map((value) => value.toUpperCase().replace(/[^0-9X]/g, ""))
    .find(isValidIsbn10);
  if (!raw10) return null;

  const firstTwelveDigits = `978${raw10.slice(0, 9)}`;
  return `${firstTwelveDigits}${isbn13CheckDigit(firstTwelveDigits)}`;
}

function bookIdentity(title: Title, isbn13: string | null) {
  if (isbn13) return `isbn:${isbn13}`;
  if (title.provider && title.providerId) {
    return `provider:${title.provider}:${title.providerId}`;
  }
  return `title:${title.id}`;
}

function logTime(log: WatchLog) {
  return log.updatedAt ?? log.watchedAt ?? log.createdAt;
}

export function buildBookshelf(
  logs: WatchLog[],
  classifications: Iterable<BookClassification> = [],
): Bookshelf {
  const classificationByIsbn = new Map(
    Array.from(classifications, (item) => [item.isbn13, item]),
  );
  const uniqueBooks = new Map<string, BookshelfBook>();

  for (const log of logs) {
    if (log.deletedAt || log.title?.type !== "book") continue;
    const isbn13 = normalizeBookIsbn13(log.title);
    const key = bookIdentity(log.title, isbn13);
    const next: BookshelfBook = {
      key,
      title: log.title,
      status: log.status,
      loggedAt: logTime(log),
      isbn13,
      classification: isbn13
        ? (classificationByIsbn.get(isbn13) ?? null)
        : null,
    };
    const existing = uniqueBooks.get(key);
    if (
      !existing ||
      new Date(next.loggedAt).getTime() > new Date(existing.loggedAt).getTime()
    ) {
      uniqueBooks.set(key, next);
    }
  }

  const books = Array.from(uniqueBooks.values()).sort(
    (left, right) =>
      new Date(right.loggedAt).getTime() - new Date(left.loggedAt).getTime(),
  );
  const groups = KDC_MAJOR_CATEGORIES.map(({ major, code }) => ({
    major,
    code,
    books: books.filter(
      (book) =>
        book.classification?.status === "RESOLVED" &&
        book.classification.kdcMajor === major,
    ),
  }));
  const unclassifiedBooks = books.filter(
    (book) =>
      book.classification?.status !== "RESOLVED" ||
      typeof book.classification.kdcMajor !== "number",
  );

  return {
    books,
    groups,
    recentBooks: books.slice(0, 8),
    unclassifiedBooks,
    categoryCount: groups.filter((group) => group.books.length > 0).length,
  };
}
