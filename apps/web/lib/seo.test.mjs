import assert from "node:assert/strict";
import test from "node:test";
import {
  localizedAlternates,
  localizedOpenGraph,
  localizedPath,
  localizedUrl,
} from "./seo.ts";

test("builds Korean default-locale and English prefixed paths", () => {
  assert.equal(localizedPath("ko"), "/");
  assert.equal(localizedPath("en"), "/en");
  assert.equal(localizedPath("ko", "/about"), "/about");
  assert.equal(localizedPath("en", "/about"), "/en/about");
});

test("builds self-canonical and reciprocal language alternates", () => {
  const alternates = localizedAlternates("en", "/faq");

  assert.equal(alternates.canonical, "https://ottline.app/en/faq");
  assert.deepEqual(alternates.languages, {
    ko: "https://ottline.app/faq",
    en: "https://ottline.app/en/faq",
    "x-default": "https://ottline.app/faq",
  });
});

test("normalizes query-free absolute URLs", () => {
  assert.equal(localizedUrl("ko", "/public/"), "https://ottline.app/public");
  assert.equal(localizedUrl("en", "guide"), "https://ottline.app/en/guide");
});

test("builds complete localized Open Graph metadata for child pages", () => {
  assert.deepEqual(
    localizedOpenGraph("en", "/faq", "FAQ | ottline", "Answers"),
    {
      title: "FAQ | ottline",
      description: "Answers",
      url: "https://ottline.app/en/faq",
      siteName: "ottline",
      locale: "en_US",
      type: "website",
      images: [
        {
          url: "https://ottline.app/og-image-20260418.png",
          width: 1200,
          height: 630,
          alt: "ottline",
        },
      ],
    },
  );
});
