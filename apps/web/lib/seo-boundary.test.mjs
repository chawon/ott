import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const read = (...segments) =>
  readFileSync(path.join(webRoot, ...segments), "utf8");

test("public listing keeps server-rendered HTML and refreshes after hydration", () => {
  const page = read("app", "[locale]", "public", "page.tsx");
  const client = read("components", "PublicDiscussionsClient.tsx");

  assert.doesNotMatch(page, /^\s*["']use client["']/);
  assert.match(page, /export const dynamic = ["']force-dynamic["']/);
  assert.doesNotMatch(page, /export const revalidate/);
  assert.match(page, /BACKEND_URL/);
  assert.match(page, /cache: ["']no-store["']/);
  assert.match(page, /initialItems=\{items\}/);
  assert.match(client, /useEffect/);
  assert.match(client, /\/discussions\/all\?limit=100/);
  assert.match(client, /setSourceItems\(freshItems\)/);
});

test("child SEO pages use the complete shared Open Graph metadata", () => {
  for (const route of ["about", "faq", "privacy", "public"]) {
    const page = read("app", "[locale]", route, "page.tsx");
    assert.match(page, /openGraph: localizedOpenGraph\(/);
  }
});

test("robots blocks bare and nested admin paths with one prefix rule", () => {
  const route = read("app", "robots.txt", "route.ts");

  assert.match(route, /Disallow: \/admin\n/);
  assert.doesNotMatch(route, /Disallow: \/admin\/\n/);
});

test("privacy rich copy renders instead of exposing its translation key", () => {
  const page = read("app", "[locale]", "privacy", "page.tsx");

  for (const locale of ["ko", "en"]) {
    const messages = JSON.parse(read("messages", `${locale}.json`));
    assert.match(messages.Privacy.section5Desc, /<strong>.+<\/strong>/);
  }

  assert.match(page, /t\.rich\("section5Desc"/);
  assert.doesNotMatch(page, /\{t\("section5Desc"\)\}/);
});
