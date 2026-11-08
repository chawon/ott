import assert from "node:assert/strict";
import test from "node:test";
import {
  effectiveRecommendationExclusions,
  importLegacyRecommendationChoices,
  normalizeRecommendationName,
  readRecommendationQueue,
  recommendationIsDismissed,
  saveRecommendationQueue,
  withRecommendationRequest,
} from "./recommendations.ts";

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values,
  };
}
const movie = {
  name: "Spider-Man: No Way Home",
  type: "movie",
  reason: "A story to meet next.",
  genres: [],
  provider: "TMDB",
  providerId: "634649",
  year: 2021,
  alternateNames: ["스파이더맨: 노 웨이 홈"],
};
const book = {
  name: "어린 왕자",
  originalName: "The Little Prince",
  alternateNames: ["The Little Prince"],
  type: "book",
  author: "앙투안 드 생텍쥐페리 / Antoine de Saint-Exupéry",
  isbn13: "9780156012195",
  provider: "KAKAO",
  providerId: "edition-ko",
  year: 2023,
};
const empty = () => ({
  legacyImported: false,
  operations: [],
  generationRequestIds: {},
});

test("typed TMDB identities remain stable across title/locale changes and separate movie/series namespaces", () => {
  assert.equal(
    recommendationIsDismissed(
      { ...movie, name: "A new translation", alternateNames: [] },
      [movie],
    ),
    true,
  );
  assert.equal(
    recommendationIsDismissed({ ...movie, providerId: "999" }, [movie]),
    false,
  );
  assert.equal(
    recommendationIsDismissed({ ...movie, type: "series" }, [movie]),
    false,
  );
  assert.equal(
    recommendationIsDismissed(
      {
        ...movie,
        provider: null,
        providerId: null,
        name: "ＳＰＩＤＥＲ MAN No Way Home",
      },
      [movie],
    ),
    true,
  );
  assert.equal(
    recommendationIsDismissed(
      { ...movie, provider: null, providerId: null, year: 1972 },
      [movie],
    ),
    false,
  );
});

test("book ISBN confirms an edition while exact work aliases plus an author connect different editions", () => {
  assert.equal(
    recommendationIsDismissed(
      { ...book, name: "Le Petit Prince", author: null },
      [book],
    ),
    true,
  );
  assert.equal(
    recommendationIsDismissed(
      {
        ...book,
        name: "The Little Prince",
        author: "Antoine de Saint-Exupéry",
        isbn13: "9780141185620",
        providerId: "edition-en",
        year: 1943,
      },
      [book],
    ),
    true,
  );
  assert.equal(
    recommendationIsDismissed(
      {
        ...book,
        isbn13: "9780141185620",
        providerId: "other",
        author: "A different author",
      },
      [book],
    ),
    false,
  );
  assert.equal(
    recommendationIsDismissed(
      { ...book, isbn13: null, providerId: "other", author: null },
      [book],
    ),
    false,
  );
  assert.equal(
    recommendationIsDismissed({ ...movie, name: book.name }, [book]),
    false,
  );
  assert.equal(normalizeRecommendationName(" Café · ＯＴＴ! "), "caféott");
});

test("pending offline exclude/restore operations project the last intention without deleting unrelated exclusions", () => {
  const other = {
    ...movie,
    name: "Another movie",
    providerId: "999",
    key: "server-other",
  };
  const excluded = { ...movie, key: "server-movie" };
  const operations = [
    { id: "exclude", kind: "exclude", item: movie },
    { id: "restore", kind: "restore", item: movie, sourceId: "exclude" },
  ];
  const visibleExclusions = effectiveRecommendationExclusions(
    [other, excluded],
    operations,
  );
  assert.equal(recommendationIsDismissed(movie, visibleExclusions), false);
  assert.equal(recommendationIsDismissed(other, visibleExclusions), true);
  assert.equal(
    recommendationIsDismissed(
      movie,
      effectiveRecommendationExclusions([], operations.slice(0, 1)),
    ),
    true,
  );
});

test("legacy name-only choices import exactly once to one owner and remain untouched after Undo", () => {
  const source = JSON.stringify(["Old Title", "다른 작품"]);
  const store = storage({
    "watchlog.dismissedRecs": source,
    "watchlog.lastRecommendRefresh": "2026-11-08T12:00:00Z",
  });
  const first = importLegacyRecommendationChoices("first", empty(), store, () =>
    crypto.randomUUID(),
  );
  assert.equal(first.operations.length, 2);
  assert.equal(first.operations[0].item.type, null);
  assert.equal(first.legacyImported, true);
  assert.equal(store.getItem("watchlog.dismissedRecs"), source);
  const afterUndo = { ...first, operations: [] };
  saveRecommendationQueue("first", afterUndo, store);
  assert.deepEqual(
    importLegacyRecommendationChoices(
      "first",
      readRecommendationQueue("first", store),
      store,
      () => crypto.randomUUID(),
    ),
    afterUndo,
  );
  assert.equal(
    importLegacyRecommendationChoices("second", empty(), store, () =>
      crypto.randomUUID(),
    ).operations.length,
    0,
  );
  assert.equal(
    store.getItem("watchlog.lastRecommendRefresh"),
    "2026-11-08T12:00:00Z",
  );
});

test("typed legacy choices retain work and edition metadata when imported", () => {
  const store = storage({
    "watchlog.recommendations.v2:first": JSON.stringify({
      dismissed: [book],
      lastRefreshedAt: "2026-11-08T12:00:00Z",
    }),
  });
  const imported = importLegacyRecommendationChoices(
    "first",
    empty(),
    store,
    () => crypto.randomUUID(),
  );
  assert.equal(imported.operations[0].item.type, "book");
  assert.equal(imported.operations[0].item.isbn13, book.isbn13);
  assert.equal(imported.operations[0].item.originalName, book.originalName);
});

test("uncertain generation identity and pending operations persist per account without a local quota field", () => {
  const store = storage();
  const first = {
    legacyImported: true,
    generationRequestIds: { ko: "50000000-0000-4000-8000-000000000071" },
    operations: [{ id: "pending", kind: "exclude", item: movie }],
  };
  saveRecommendationQueue("first", first, store);
  assert.deepEqual(readRecommendationQueue("first", store), first);
  assert.deepEqual(readRecommendationQueue("second", store), empty());
  assert.equal(
    Object.hasOwn(readRecommendationQueue("first", store), "lastRefreshedAt"),
    false,
  );
});

test("malformed or blocked browser storage cannot fabricate operations or bypass server quota", () => {
  for (const raw of ["broken JSON", "null", '{"operations":[null,{},1]}']) {
    assert.deepEqual(
      readRecommendationQueue(
        "first",
        storage({ "watchlog.recommendations.sync.v1:first": raw }),
      ),
      empty(),
    );
  }
  const unavailable = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(readRecommendationQueue("first", unavailable), empty());
  assert.doesNotThrow(() =>
    saveRecommendationQueue("first", empty(), unavailable),
  );
});

test("pending generation IDs belong to their original locale while exclusions stay account-wide", () => {
  const koId = "50000000-0000-4000-8000-000000000071";
  const enId = "50000000-0000-4000-8000-000000000072";
  const ko = withRecommendationRequest(empty(), "ko", koId);
  const both = withRecommendationRequest(ko, "en", enId);
  const completedKo = withRecommendationRequest(both, "ko", null);
  assert.deepEqual(completedKo.generationRequestIds, { en: enId });
  assert.equal(both.generationRequestIds.ko, koId);
});
