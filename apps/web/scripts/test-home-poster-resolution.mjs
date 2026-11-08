/** Read-only image resolution regression against the actual home and local API. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import sharp from "sharp";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:4173");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname));
const cases = process.env.POSTER_TEST_CASES
  ? JSON.parse(process.env.POSTER_TEST_CASES)
  : [
      [1440, 1],
      [1440, 2],
      [1440, 3],
      [1024, 2],
      [768, 2],
      [640, 2],
      [390, 3],
    ];
const output = "/tmp/ottline-home-poster-resolution";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
});
const metrics = [];
const imageCache = new Map();
try {
  for (const [width, dpr] of cases) {
    const context = await browser.newContext({
      viewport: { width, height: 1100 },
      deviceScaleFactor: dpr,
      locale: "ko-KR",
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (/google-analytics|googletagmanager|clarity\.ms/.test(url.hostname))
        return route.abort();
      if (
        url.origin === base.origin &&
        url.pathname.startsWith("/api/") &&
        !["GET", "HEAD", "OPTIONS"].includes(request.method())
      )
        return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base.href, { waitUntil: "domcontentloaded" });
    const rail = page
      .getByText("요즘 인기 작품", { exact: true })
      .first()
      .locator("..");
    await rail.waitFor({ timeout: 30_000 });
    const images = rail.locator("img");
    assert.ok(
      (await images.count()) > 0,
      "Actual popular posters must be present",
    );
    for (const img of await images.all()) {
      await img.scrollIntoViewIfNeeded();
      await img.evaluate((node) => node.decode());
      const data = await img.evaluate((node) => ({
        title: node.alt,
        url: node.currentSrc,
        displayWidth: node.getBoundingClientRect().width,
      }));
      if (!imageCache.has(data.url)) {
        imageCache.set(
          data.url,
          (async () => {
            const response = await context.request.get(data.url);
            assert.equal(response.status(), 200);
            return sharp(await response.body()).metadata();
          })(),
        );
      }
      const decoded = await imageCache.get(data.url);
      const imageUrl = new URL(data.url);
      const source = new URL(imageUrl.searchParams.get("url") ?? data.url);
      const sourceWidth =
        Number(source.pathname.match(/\/w(\d+)\//)?.[1]) || null;
      const required = Math.ceil(data.displayWidth * dpr);
      const result = {
        viewport: width,
        dpr,
        title: data.title,
        displayWidth: Math.round(data.displayWidth * 10) / 10,
        required,
        downloadedWidth: decoded.width,
        sourceWidth,
        hasEnoughPixels:
          decoded.width >= required &&
          (!sourceWidth || sourceWidth >= required),
      };
      metrics.push(result);
      console.log(JSON.stringify(result));
    }
    await rail.screenshot({ path: `${output}/${width}-${dpr}.png` });
    assert.deepEqual(errors, []);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("watchlog.userId")),
      null,
    );
    await context.close();
  }
  await writeFile(`${output}/result.json`, JSON.stringify(metrics, null, 2));
  assert.ok(
    metrics.every((item) => item.hasEnoughPixels),
    "Popular posters must not enlarge undersized optimizer images or TMDB thumbnails",
  );
  console.log(`PASS ${metrics.length} real poster measurements`);
} finally {
  await browser.close();
}
