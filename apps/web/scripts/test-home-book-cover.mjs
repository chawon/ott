/** Actual provider image bytes; isolated Home records and deterministic image failures.
 * No real account, record, or public writes. Defaults to the local development API.
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3000");
assert.ok(
  base.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(base.hostname),
);
const output =
  process.env.BOOK_COVER_QA_OUTPUT ?? join(tmpdir(), "ottline-book-cover");
const scenario = process.env.BOOK_COVER_CASE ?? "original";
const width = Number(process.env.BOOK_COVER_WIDTH ?? 1440);
const locale = process.env.BOOK_COVER_LOCALE ?? "ko";
await mkdir(output, { recursive: true });
let book;
if (process.env.BOOK_COVER_SOURCE_FILE) {
  book = JSON.parse(
    await readFile(process.env.BOOK_COVER_SOURCE_FILE, "utf8"),
  ).book;
} else {
  const response = await fetch(
    new URL(
      `/api/titles/search?${new URLSearchParams({ q: "소년이 온다", type: "book" })}`,
      base,
    ),
    { headers: { "Accept-Language": "ko-KR" } },
  );
  assert.equal(response.status, 200);
  book = (await response.json()).find(
    (item) => item.type === "book" && item.posterUrl,
  );
}
assert.ok(book?.posterUrl, "a real provider cover is required");
const thumbnailUrl = book.posterUrl;
const embedded = new URL(new URL(thumbnailUrl).searchParams.get("fname"));
assert.equal(embedded.hostname, "t1.daumcdn.net");
assert.ok(embedded.pathname.startsWith("/lbook/image/"));
embedded.protocol = "https:";
const originalUrl = embedded.href;
async function imageBytes(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  assert.equal(response.status, 200);
  return Buffer.from(await response.arrayBuffer());
}
const [thumbnail, original] = await Promise.all([
  process.env.BOOK_COVER_THUMBNAIL_FILE
    ? readFile(process.env.BOOK_COVER_THUMBNAIL_FILE)
    : imageBytes(thumbnailUrl),
  process.env.BOOK_COVER_ORIGINAL_FILE
    ? readFile(process.env.BOOK_COVER_ORIGINAL_FILE)
    : imageBytes(originalUrl),
]);
const [thumbMeta, originalMeta] = await Promise.all([
  sharp(thumbnail).metadata(),
  sharp(original).metadata(),
]);
assert.ok(
  originalMeta.width > thumbMeta.width,
  "sample must include a genuinely larger cover",
);
const unknownUrl = "https://example.org/unchanged-book-cover.jpg";
const storedUrl =
  scenario === "unsupported"
    ? unknownUrl
    : scenario === "missing"
      ? null
      : thumbnailUrl;
const title = {
  ...book,
  id: "10000000-0000-4000-8000-000000000041",
  type: "book",
  posterUrl: storedUrl,
};
const log = {
  id: "20000000-0000-4000-8000-000000000041",
  titleId: title.id,
  title,
  status: "DONE",
  rating: 5,
  note: "책장을 덮고 나서도 오래 남는 문장과 그날의 마음을 함께 기억해 두고 싶어요. ".repeat(
    15,
  ),
  watchedAt: "2026-11-07T00:00:00Z",
  createdAt: "2026-11-07T00:00:00Z",
  updatedAt: "2026-11-07T00:00:00Z",
  origin: "LOG",
  spoiler: false,
  place: "HOME",
  occasion: "ALONE",
  syncStatus: "synced",
};
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
const requests = [],
  errors = [];
try {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    locale: locale === "ko" ? "ko-KR" : "en-US",
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      "watchlog.userId",
      "30000000-0000-4000-8000-000000000041",
    );
    localStorage.setItem(
      "watchlog.deviceId",
      "40000000-0000-4000-8000-000000000041",
    );
    localStorage.setItem("watchlog.pairingCode", "ISOLATED-BOOK-COVER");
  });
  await context.route("**/*", (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      if (request.method() !== "GET") return route.fulfill({ status: 204 });
      if (url.pathname === "/api/logs") return route.fulfill({ json: [log] });
      if (url.pathname === "/api/auth/profile")
        return route.fulfill({
          json: { nickname: null, personaKey: "book_drifter" },
        });
      if (url.pathname === "/api/sync/pull")
        return route.fulfill({
          json: {
            serverTime: new Date().toISOString(),
            changes: { titles: [title], logs: [log] },
          },
        });
      return route.fulfill({ json: [] });
    }
    if (url.href === originalUrl) {
      requests.push("original");
      if (scenario === "original-fails" || scenario === "all-fail")
        return route.fulfill({ status: 404 });
      if (process.env.BOOK_COVER_LIVE_IMAGE === "1") return route.continue();
      return route.fulfill({ contentType: "image/jpeg", body: original });
    }
    if (url.href === thumbnailUrl || url.href === unknownUrl) {
      requests.push("thumbnail");
      if (scenario === "all-fail") return route.fulfill({ status: 404 });
      return route.fulfill({ contentType: "image/jpeg", body: thumbnail });
    }
    return url.origin === base.origin ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(new URL(`/${locale}`, base).href, {
    waitUntil: "domcontentloaded",
  });
  const featured = page.getByTestId("home-featured");
  await featured.waitFor();
  const poster = featured.locator('div[data-media-type="book"]');
  let metrics;
  if (scenario === "all-fail" || scenario === "missing") {
    await poster.locator('span[class*="posterFallback"]').waitFor();
    metrics = {
      fallbackVisible: true,
      imageCount: await poster.locator("img").count(),
    };
  } else {
    const image = poster.locator("img");
    await image.waitFor();
    await page.waitForFunction(() => {
      const img = document.querySelector(
        '[data-testid="home-featured"] div[data-media-type="book"] img',
      );
      return (
        img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0
      );
    });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });
    metrics = await image.evaluate((node) => ({
      src: node.currentSrc,
      nativeWidth: node.naturalWidth,
      nativeHeight: node.naturalHeight,
      displayWidth: node.getBoundingClientRect().width,
      displayHeight: node.getBoundingClientRect().height,
    }));
  }
  const layout = await poster.evaluate((node) => {
    const note = document.querySelector(
      '[data-testid="home-featured"] blockquote',
    );
    return {
      frameWidth: node.getBoundingClientRect().width,
      frameHeight: node.getBoundingClientRect().height,
      noteLines: note
        ? getComputedStyle(note)
            .getPropertyValue("--featured-note-lines")
            .trim()
        : null,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  await page.screenshot({ path: join(output, "home.png") });
  const result = {
    scenario,
    locale,
    width,
    title: book.name,
    thumbnailWidth: thumbMeta.width,
    originalWidth: originalMeta.width,
    metrics,
    layout,
    requests,
    errors,
    actualApiWrites: 0,
  };
  await writeFile(join(output, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (scenario === "original") {
    assert.equal(
      metrics.src,
      originalUrl,
      "Home must load the larger original cover, not the search thumbnail",
    );
    assert.ok(metrics.nativeWidth > thumbMeta.width);
  }
  if (scenario === "original-fails") {
    assert.deepEqual(requests, ["original", "thumbnail"]);
    assert.equal(metrics.src, thumbnailUrl);
  }
  if (scenario === "unsupported") {
    assert.deepEqual(requests, ["thumbnail"]);
    assert.equal(metrics.src, unknownUrl);
  }
  if (metrics.imageCount === undefined) {
    assert.ok(
      metrics.displayWidth <= layout.frameWidth + 1 &&
        metrics.displayHeight <= layout.frameHeight + 1,
      "the whole cover must fit inside its frame without cropping",
    );
    assert.ok(
      metrics.displayWidth <= metrics.nativeWidth + 1,
      "a small cover must not be enlarged past its native width",
    );
    assert.ok(
      metrics.displayHeight <= metrics.nativeHeight + 1,
      "a small cover must not be enlarged past its native height",
    );
  }
  if (scenario === "all-fail")
    assert.deepEqual(requests, ["original", "thumbnail"]);
  assert.deepEqual(errors, []);
  assert.equal(layout.overflow, false);
  await context.close();
} finally {
  await browser.close();
}
