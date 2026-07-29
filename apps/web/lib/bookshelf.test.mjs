import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBookshelf,
  isKdcBookshelfLocale,
  isValidIsbn10,
  isValidIsbn13,
  normalizeBookIsbn13,
} from "./bookshelf.ts";

function bookLog({ id, isbn13, isbn10, status = "DONE", updatedAt }) {
  return {
    id,
    title: {
      id: `title-${id}`,
      type: "book",
      name: `Book ${id}`,
      isbn13,
      isbn10,
      provider: "NAVER",
      providerId: isbn13 ?? isbn10 ?? id,
    },
    status,
    spoiler: false,
    watchedAt: updatedAt,
    createdAt: updatedAt,
    updatedAt,
  };
}

test("validates ISBN13 and converts a valid ISBN10", () => {
  assert.equal(isValidIsbn13("9788983921987"), true);
  assert.equal(isValidIsbn13("9788983921988"), false);
  assert.equal(isValidIsbn10("8983921986"), true);
  assert.equal(
    normalizeBookIsbn13({ isbn10: "8983921986", isbn13: null }),
    "9788983921987",
  );
});

test("recovers a missing ISBN from a NAVER provider id", () => {
  assert.equal(
    normalizeBookIsbn13({
      isbn10: null,
      isbn13: null,
      provider: "NAVER",
      providerId: "9788983921987",
    }),
    "9788983921987",
  );
  assert.equal(
    normalizeBookIsbn13({
      isbn10: null,
      isbn13: null,
      provider: "TMDB",
      providerId: "9788983921987",
    }),
    null,
  );
});

test("exposes the KDC bookshelf only to Korean locale", () => {
  assert.equal(isKdcBookshelfLocale("ko"), true);
  assert.equal(isKdcBookshelfLocale("en"), false);
});

test("keeps bookshelf groups in canonical KDC number order", () => {
  const shelf = buildBookshelf([]);

  assert.deepEqual(
    shelf.groups.map((group) => group.code),
    ["000", "100", "200", "300", "400", "500", "600", "700", "800", "900"],
  );
});

test("counts every status equally and deduplicates the same edition", () => {
  const logs = [
    bookLog({
      id: "done",
      isbn13: "9788983921987",
      status: "DONE",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }),
    bookLog({
      id: "wishlist",
      isbn13: "9788983921987",
      status: "WISHLIST",
      updatedAt: "2026-02-01T00:00:00.000Z",
    }),
    bookLog({
      id: "reading",
      isbn13: "9788936434267",
      status: "IN_PROGRESS",
      updatedAt: "2026-03-01T00:00:00.000Z",
    }),
  ];
  const classifications = [
    {
      isbn13: "9788983921987",
      status: "RESOLVED",
      kdcCode: "813.7",
      kdcMajor: 8,
      fetchedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      isbn13: "9788936434267",
      status: "RESOLVED",
      kdcCode: "813.7",
      kdcMajor: 8,
      fetchedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  const shelf = buildBookshelf(logs, classifications);

  assert.equal(shelf.books.length, 2);
  assert.equal(shelf.groups[8].books.length, 2);
  assert.equal(
    shelf.books.find((book) => book.isbn13 === "9788983921987").status,
    "WISHLIST",
  );
});

test("keeps missing and not-found classifications in the waiting area", () => {
  const logs = [
    bookLog({
      id: "missing",
      isbn13: undefined,
      status: "DONE",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }),
    bookLog({
      id: "not-found",
      isbn13: "9788983921987",
      status: "DONE",
      updatedAt: "2026-02-01T00:00:00.000Z",
    }),
  ];
  const classifications = [
    {
      isbn13: "9788983921987",
      status: "NOT_FOUND",
      kdcCode: null,
      kdcMajor: null,
      fetchedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  const shelf = buildBookshelf(logs, classifications);

  assert.equal(shelf.books.length, 2);
  assert.equal(shelf.unclassifiedBooks.length, 2);
  assert.equal(shelf.categoryCount, 0);
});
