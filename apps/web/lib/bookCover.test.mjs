import assert from "node:assert/strict";
import test from "node:test";
import { originalBookCoverUrl } from "./bookCover.ts";

function thumbnail(filename, host = "search1.kakaocdn.net") {
  return `https://${host}/thumb/R120x174.q85/?${new URLSearchParams({ fname: filename })}`;
}

test("uses the provided book image over HTTPS, preserving its version query", () => {
  for (const scheme of ["http", "https"]) {
    assert.equal(
      originalBookCoverUrl(
        thumbnail(
          `${scheme}://t1.daumcdn.net/lbook/image/532683?timestamp=20261107110839`,
        ),
      ),
      "https://t1.daumcdn.net/lbook/image/532683?timestamp=20261107110839",
    );
  }
});

test("leaves other providers and malformed image addresses untouched", () => {
  for (const source of [
    "",
    "not a URL",
    "https://books.google.com/books/content?id=abc&zoom=1",
    "https://t1.daumcdn.net/lbook/image/532683",
    "https://search1.kakaocdn.net/thumb/R120x174.q85/",
    thumbnail("not a URL"),
  ]) {
    assert.equal(originalBookCoverUrl(source), null, source);
  }
});

test("only extracts book images from the recognized Kakao and Daum paths", () => {
  const original = "https://t1.daumcdn.net/lbook/image/532683";
  for (const source of [
    thumbnail(original, "search1.kakaocdn.net.example.org"),
    thumbnail(original, "example.org"),
    thumbnail(original).replace("/thumb/", "/other/"),
    thumbnail(original).replace("https://", "ftp://"),
    thumbnail(original).replace("search1.", "user:password@search1."),
    thumbnail(original).replace(".net/", ".net:8443/"),
    thumbnail("https://t1.daumcdn.net.example.org/lbook/image/532683"),
    thumbnail("https://example.org/lbook/image/532683"),
    thumbnail("https://t1.daumcdn.net/other/532683"),
    thumbnail("https://t1.daumcdn.net/lbook/image/532683/other"),
    thumbnail("https://user:password@t1.daumcdn.net/lbook/image/532683"),
    thumbnail("https://t1.daumcdn.net:8443/lbook/image/532683"),
    thumbnail("ftp://t1.daumcdn.net/lbook/image/532683"),
  ]) {
    assert.equal(originalBookCoverUrl(source), null, source);
  }
});
