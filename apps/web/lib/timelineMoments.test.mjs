import assert from "node:assert/strict";
import test from "node:test";
import {
  collectTimelineMoments,
  readMomentFilters,
} from "./timelineMoments.ts";

function record(id, overrides = {}) {
  return { id, status: "DONE", title: { id: `title-${id}` }, ...overrides };
}

test("moment links count actual kept records without notes, duplicates, or wishlists", () => {
  const moments = collectTimelineMoments([
    record("one", { place: "HOME", occasion: "ALONE", note: "" }),
    record("one", { place: "HOME", occasion: "ALONE" }),
    record("two", { place: "HOME", occasion: "FAMILY", status: "IN_PROGRESS" }),
    record("three", { place: "THEATER", occasion: "FAMILY" }),
    record("wishlist", {
      status: "WISHLIST",
      place: "HOME",
      occasion: "ALONE",
    }),
    record("deleted", { deletedAt: "2026-01-01", place: "HOME" }),
    record("missing-title", { title: null, place: "HOME" }),
    record("unknown-values", { place: "UNKNOWN", occasion: "__proto__" }),
  ]);
  assert.deepEqual(moments, [
    { field: "place", value: "HOME", count: 2 },
    { field: "place", value: "THEATER", count: 1 },
    { field: "occasion", value: "FAMILY", count: 2 },
    { field: "occasion", value: "ALONE", count: 1 },
  ]);
});

test("moment links take up to three places and three occasions and omit empty groups", () => {
  assert.deepEqual(collectTimelineMoments([]), []);
  assert.deepEqual(collectTimelineMoments([record("empty")]), []);
  const values = ["HOME", "CAFE", "THEATER", "LIBRARY"];
  const moments = collectTimelineMoments(
    values.map((place, index) => record(`${index}`, { place })),
  );
  assert.equal(moments.length, 3);
  assert.ok(
    moments.every((moment) => moment.field === "place" && moment.count === 1),
  );
});

test("timeline accepts only known place and occasion query values", () => {
  assert.deepEqual(
    readMomentFilters(new URLSearchParams("place=HOME&occasion=ALONE&q=film")),
    { place: "HOME", occasion: "ALONE" },
  );
  for (const place of ["__proto__", "constructor", "home", "HOME ", "UNKNOWN"])
    assert.equal(readMomentFilters(new URLSearchParams({ place })).place, "");
  for (const occasion of ["toString", "alone", "UNKNOWN"])
    assert.equal(
      readMomentFilters(new URLSearchParams({ occasion })).occasion,
      "",
    );
  assert.deepEqual(readMomentFilters(new URLSearchParams()), {
    place: "",
    occasion: "",
  });
});
