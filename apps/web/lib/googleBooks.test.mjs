import assert from "node:assert/strict";
import test from "node:test";
import { googleBooksUrl } from "./googleBooks.ts";

test("keeps the Google source link after an ISBN match preserves a legacy provider", () => {
  assert.equal(
    googleBooksUrl({
      provider: "NAVER",
      providerId: "old-id",
      sourceUrl: "https://books.google.com/books?id=volume",
    }),
    "https://books.google.com/books?id=volume",
  );
});

test("encodes opaque Google volume IDs and ignores unrelated providers", () => {
  assert.equal(
    googleBooksUrl({ provider: "GOOGLE_BOOKS", providerId: "a&b" }),
    "https://books.google.com/books?id=a%26b",
  );
  assert.equal(googleBooksUrl({ provider: "KAKAO", providerId: "123" }), null);
});

test("rejects unsupported and misleading external source URLs", () => {
  for (const sourceUrl of [
    "javascript:alert(1)",
    "https://books.google.com.evil.example/",
    "https://user@books.google.com/",
    "http://books.google.com/",
    "invalid",
  ]) {
    assert.equal(googleBooksUrl({ sourceUrl }), null);
  }
});
