import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  APP_STORE_URL,
  buildBrowserExtensionSchema,
  buildSoftwareApplicationSchema,
  CHROME_WEB_STORE_URL,
  EDGE_ADDONS_URL,
  GOOGLE_PLAY_URL,
  localizedAlternates,
  localizedBrowserExtensionUrls,
  localizedOpenGraph,
  localizedPath,
  localizedStoreUrls,
  localizedUrl,
  MICROSOFT_STORE_URL,
  WHALE_STORE_URL,
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

test("links the software entity to localized official install pages", () => {
  assert.deepEqual(localizedStoreUrls("ko"), {
    googlePlay: `${GOOGLE_PLAY_URL}&hl=ko&gl=KR`,
    appStore: "https://apps.apple.com/kr/app/ottline/id6780318110",
  });
  assert.deepEqual(localizedStoreUrls("en"), {
    googlePlay: `${GOOGLE_PLAY_URL}&hl=en`,
    appStore: APP_STORE_URL,
  });

  const schema = buildSoftwareApplicationSchema({
    locale: "ko",
    description: "영화와 책을 기록하는 개인 타임라인",
  });

  assert.equal(schema["@id"], "https://ottline.app/#software-application");
  assert.deepEqual(schema.operatingSystem, [
    "Web",
    "Android",
    "iOS",
    "Windows",
  ]);
  assert.deepEqual(schema.sameAs, [
    GOOGLE_PLAY_URL,
    APP_STORE_URL,
    MICROSOFT_STORE_URL,
  ]);
  assert.deepEqual(schema.installUrl, [
    `${GOOGLE_PLAY_URL}&hl=ko&gl=KR`,
    "https://apps.apple.com/kr/app/ottline/id6780318110",
    MICROSOFT_STORE_URL,
  ]);
});

test("describes the browser extension as its own localized software entity", () => {
  assert.deepEqual(localizedBrowserExtensionUrls("en"), {
    chrome: `${CHROME_WEB_STORE_URL}?hl=en`,
    edge: `${EDGE_ADDONS_URL}?hl=en`,
    whale: WHALE_STORE_URL,
  });

  const schema = buildBrowserExtensionSchema({
    locale: "ko",
    description: "작품 제목을 ottline 기록 화면으로 이어주는 도우미",
  });
  const extensionManifest = JSON.parse(
    readFileSync(
      new URL("../../browser-extension/manifest.json", import.meta.url),
      "utf8",
    ),
  );

  assert.equal(schema["@id"], "https://ottline.app/#browser-extension");
  assert.equal(schema.name, "ottline - OTT 기록 도우미");
  assert.equal(schema.softwareVersion, extensionManifest.version);
  assert.deepEqual(schema.sameAs, [
    CHROME_WEB_STORE_URL,
    EDGE_ADDONS_URL,
    WHALE_STORE_URL,
  ]);
  assert.deepEqual(schema.installUrl, [
    `${CHROME_WEB_STORE_URL}?hl=ko`,
    `${EDGE_ADDONS_URL}?hl=ko`,
    WHALE_STORE_URL,
  ]);
});
