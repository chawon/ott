/** Season posters and their release years must describe the same saved season.
 * Isolated API responses and browser storage only; no real account writes.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3000");
assert.ok(
  base.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(base.hostname),
);
const output =
  process.env.SERIES_YEAR_QA_OUTPUT ?? join(tmpdir(), "ottline-season-year");
await mkdir(output, { recursive: true });
const scenario = process.env.SERIES_YEAR_CASE ?? "saved";
const locale = process.env.SERIES_YEAR_LOCALE ?? "ko";
const expectedYear =
  scenario === "missing-year" || scenario === "no-season" ? 2021 : 2025;
const title = {
  id: "10000000-0000-4000-8000-000000000021",
  type: "series",
  provider: "TMDB",
  providerId: "isolated-season-year",
  name: "시즌 연도 검증",
  year: 2021,
  posterUrl: "/season-year-fixture/series.svg",
};
const log = {
  id: "20000000-0000-4000-8000-000000000021",
  titleId: title.id,
  title,
  status: "DONE",
  seasonNumber: 3,
  episodeNumber: 2,
  seasonPosterUrl: "/season-year-fixture/season-3.svg",
  seasonYear: 2025,
  watchedAt: "2026-11-07T00:00:00Z",
  createdAt: "2026-11-07T00:00:00Z",
  updatedAt: "2026-11-07T00:00:00Z",
  origin: "LOG",
  spoiler: false,
  syncStatus: "synced",
};
if (scenario === "missing-year") log.seasonYear = null;
if (scenario === "no-season") {
  log.seasonNumber = null;
  log.episodeNumber = null;
  log.seasonYear = null;
  log.seasonPosterUrl = null;
}
let current = scenario === "recording" ? null : log;
const pushes = [];
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
let page;
try {
  const context = await browser.newContext({
    viewport: { width: locale === "ko" ? 390 : 1440, height: 900 },
    locale: locale === "ko" ? "ko-KR" : "en-US",
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      "watchlog.userId",
      "30000000-0000-4000-8000-000000000021",
    );
    localStorage.setItem(
      "watchlog.deviceId",
      "40000000-0000-4000-8000-000000000021",
    );
    localStorage.setItem("watchlog.pairingCode", "ISOLATED-SEASON-YEAR");
  });
  await context.route("**/season-year-fixture/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="180"><rect width="120" height="180" fill="#ddd"/></svg>',
    }),
  );
  await context.route("**/api/**", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/sync/push") {
      const body = request.postDataJSON();
      pushes.push(body);
      for (const change of body.changes.logs) {
        current = {
          ...log,
          ...current,
          ...change.payload,
          id: change.id,
          titleId: title.id,
          title,
          updatedAt: change.updatedAt,
        };
      }
      return route.fulfill({
        json: {
          accepted: body.changes.logs.map((change) => change.id),
          rejected: [],
        },
      });
    }
    if (request.method() !== "GET") return route.fulfill({ status: 204 });
    if (url.pathname === "/api/titles/search")
      return route.fulfill({
        json:
          url.searchParams.get("type") === "book"
            ? []
            : [{ ...title, titleId: title.id }],
      });
    if (url.pathname === `/api/titles/${title.id}`)
      return route.fulfill({ json: title });
    if (url.pathname === "/api/logs")
      return route.fulfill({ json: current ? [current] : [] });
    if (url.pathname === "/api/logs/page")
      return route.fulfill({
        json: { items: current ? [current] : [], nextCursor: null },
      });
    if (url.pathname === "/api/auth/profile")
      return route.fulfill({
        json: { nickname: null, personaKey: "cinema_keeper" },
      });
    if (url.pathname === "/api/sync/pull")
      return route.fulfill({
        json: {
          serverTime: new Date().toISOString(),
          changes: { titles: [title], logs: current ? [current] : [] },
        },
      });
    if (url.pathname.endsWith("/seasons"))
      return route.fulfill({
        json: [
          {
            seasonNumber: 1,
            name: "Season 1",
            year: 2021,
            posterUrl: title.posterUrl,
          },
          {
            seasonNumber: 3,
            name: "Season 3",
            year: 2025,
            posterUrl: "/season-year-fixture/season-3.svg",
          },
        ],
      });
    if (/\/seasons\/\d+$/.test(url.pathname))
      return route.fulfill({
        json: [
          { episodeNumber: 1, name: "Episode 1" },
          { episodeNumber: 2, name: "Episode 2" },
        ],
      });
    return route.fulfill({ json: [] });
  });
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.setDefaultTimeout(10_000);
  const observations = [];
  async function inspect(label, scope, year = expectedYear) {
    const text = await scope.innerText();
    observations.push({ surface: label, metadata: text });
    assert.match(
      text,
      new RegExp(`\\b${year}\\b`),
      `${label} must use the selected season's year`,
    );
  }
  if (scenario === "recording") {
    await page.goto(`${base.origin}/${locale}?quick=1`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByTestId("title-search").fill(title.name);
    await page.getByTestId("title-search-result").first().click();
    await page
      .locator("summary")
      .filter({
        hasText:
          locale === "ko" ? "그날의 순간 (선택)" : "The moment (optional)",
      })
      .click();
    await page.getByTestId("record-season").selectOption("3");
    const summary = page.locator('div[class*="titleSummary"]');
    await summary.locator('img[src$="season-3.svg"]').waitFor();
    await inspect("record input", summary.locator("p").first());
    await page.getByTestId("record-status-DONE").click();
    await page.getByTestId("record-save-initial").click();
    await page.getByTestId("record-edit-details").click();
    await page.getByTestId("record-season").selectOption("1");
    await summary.locator('img[src$="series.svg"]').waitFor();
    await inspect("switch to season 1", summary.locator("p").first(), 2021);
    await page.getByTestId("record-season").selectOption("");
    await inspect("clear season", summary.locator("p").first(), 2021);
    await page.getByTestId("record-season").selectOption("3");
    await summary.locator('img[src$="season-3.svg"]').waitFor();
    await inspect("switch back to season 3", summary.locator("p").first());
    await page.getByTestId("record-episode").selectOption("2");
    await page.getByTestId("record-note").fill("Isolated season year check");
    await page.getByTestId("record-save-details").click();
    await page.getByTestId("record-done").click();
    assert.equal(current.seasonYear, 2025);
    assert.equal(current.seasonNumber, 3);
    assert.equal(
      current.title.year,
      2021,
      "season display must not overwrite the shared series premiere year",
    );
    assert.ok(
      pushes.some((body) =>
        body.changes.logs.some((change) => change.payload.seasonYear === 2025),
      ),
    );
  }
  await page.goto(`${base.origin}/${locale}/title/${title.id}`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByTestId("record-detail-edit").waitFor();
  const hero = page.locator('section[class*="detailHero"]');
  const poster = await hero.locator("img").getAttribute("src");
  const metadata = await hero.locator('p[class*="eyebrow"]').innerText();
  await page.screenshot({ path: join(output, "detail.png") });
  const result = {
    scenario,
    locale,
    savedSeason: current.seasonNumber,
    savedSeasonYear: current.seasonYear,
    seriesYear: title.year,
    poster,
    metadata,
    errors,
    actualApiWrites: 0,
  };
  await writeFile(join(output, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  assert.equal(
    poster,
    current.seasonPosterUrl || title.posterUrl,
    "the saved season poster must be shown",
  );
  await inspect("detail", hero.locator('p[class*="eyebrow"]'));
  await page.goto(`${base.origin}/${locale}`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByTestId("home-featured").waitFor();
  await inspect(
    "home",
    page.locator('div[class*="featuredStory"] > p').first(),
  );
  await page.goto(`${base.origin}/${locale}/timeline`, {
    waitUntil: "domcontentloaded",
  });
  const card = page
    .getByTestId("timeline-record")
    .filter({ hasText: title.name });
  await card.waitFor();
  await inspect(
    "timeline",
    card.locator('div[class*="recordMeta"] > span').first(),
  );
  assert.deepEqual(errors, []);
  await writeFile(
    join(output, "result.json"),
    JSON.stringify({ ...result, result: "PASS", observations }, null, 2),
  );
  console.log(
    JSON.stringify({
      result: "PASS",
      scenario,
      locale,
      observations,
      actualApiWrites: 0,
    }),
  );
  await context.close();
} catch (error) {
  const failure = {
    result: "FAIL",
    scenario,
    locale,
    errors,
    url: page?.url(),
    message: error.message,
    main: await page
      ?.locator("main")
      .innerText({ timeout: 1000 })
      .catch(() => null),
  };
  await writeFile(
    join(output, "failure.json"),
    JSON.stringify(failure, null, 2),
  );
  console.error(JSON.stringify(failure));
  await page
    ?.screenshot({ path: join(output, "failure.png"), timeout: 3000 })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
