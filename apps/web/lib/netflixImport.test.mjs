import assert from "node:assert/strict";
import { test } from "node:test";
import {
  matchNetflixTitle,
  parseNetflixHistoryCsv,
  prepareNetflixImportRows,
} from "./netflixImport.ts";

function log(id, name, type) {
  return { id, title: { id, name, type } };
}

test("parses Netflix CSV quoting, episode metadata and repeated same-day rows", async () => {
  const csv =
    '\uFEFFTitle,Date\r\n"A Show: 시즌 2: 제3화, 다음 날",9/21/26\r\n"A Show: 시즌 2: 제3화, 다음 날",9/21/26\r\n"Film: A ""Special"" Story",9/20/26\r\n';
  const parsed = parseNetflixHistoryCsv(csv, 2026);
  assert.equal(parsed.length, 3);
  assert.deepEqual(
    parsed.slice(0, 2).map((row) => row.occurrence),
    [1, 2],
  );
  assert.equal(parsed[0].workTitle, "A Show");
  assert.equal(parsed[0].seasonNumber, 2);
  assert.equal(parsed[0].episodeNumber, 3);
  assert.equal(parsed[2].rawTitle, 'Film: A "Special" Story');

  const rows = await prepareNetflixImportRows(parsed, [
    log("show", "A Show", "series"),
    log("film", 'Film: A "Special" Story', "movie"),
  ]);
  assert.equal(rows[0].linkedTitleId, "show");
  assert.equal(rows[2].linkedTitleId, "film");
  assert.notEqual(rows[0].sourceKey, rows[1].sourceKey);
  assert.equal(rows[0].sourceKey.length, 64);
});

test("browser source key matches the API hash contract", async () => {
  const parsed = parseNetflixHistoryCsv(
    "Title,Date\nA Show: 시즌 2: 제3화,9/21/26",
    2026,
  );
  const [row] = await prepareNetflixImportRows(parsed, []);
  assert.equal(
    row.sourceKey,
    "04a7c72f613657c4707c200e9fde5a9f30f05768e940e236720645e1f99c8355",
  );
});

test("does not guess a link for ambiguous works or unrelated subtitles", () => {
  const [episode, spinOff] = parseNetflixHistoryCsv(
    "Title,Date\nA Show: 시즌 1: 1화,1/2/26\nA Show: Reunion,1/3/26",
    2026,
  );
  assert.equal(
    matchNetflixTitle(episode, [
      log("a", "A Show", "series"),
      log("b", "A Show", "series"),
    ]),
    null,
  );
  assert.equal(
    matchNetflixTitle(spinOff, [log("a", "A Show", "series")]),
    null,
  );
});

test("rejects malformed headers, dates and unterminated quotes", () => {
  assert.throws(() => parseNetflixHistoryCsv("Name,Date\nFilm,1/1/26", 2026));
  assert.throws(() => parseNetflixHistoryCsv("Title,Date\nFilm,2/30/26", 2026));
  assert.throws(() =>
    parseNetflixHistoryCsv("Title,Date\nFilm,1/1/2099", 2026),
  );
  assert.throws(() => parseNetflixHistoryCsv('Title,Date\n"Film,1/1/26', 2026));
});
