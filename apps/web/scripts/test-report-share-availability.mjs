/** Render actual report controls; all API and card requests are isolated. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3218");
assert.ok(
  ["127.0.0.1", "localhost"].includes(base.hostname) ||
    (process.env.REPORT_SHARE_QA_ALLOW_PREVIEW === "1" &&
      base.hostname === "172.24.75.199"),
);
const output =
  process.env.REPORT_SHARE_QA_OUTPUT ?? join(tmpdir(), "ottline-report-share");
await mkdir(output, { recursive: true });
const empty = {
  totalLogs: 0,
  thisMonthLogs: 0,
  previousWeekLogs: 0,
  previousWeekPosters: [],
  doneRatePct: 0,
  ratingFillPct: 0,
  noteFillPct: 0,
  topType: "-",
  topPlace: "-",
  topOccasion: "-",
  streakDays: 0,
  longestStreakDays: 0,
  lastLoggedAt: null,
  monthlyTopGenre: "-",
  monthlyTopGenreCount: 0,
  daysSinceLastLog: 0,
  continueSeriesTitleId: null,
  continueSeriesTitle: null,
  continueSeriesSeasonNumber: null,
  continueSeriesEpisodeNumber: null,
  seasonalRecap: null,
};
const recap = {
  key: "2026-H1",
  startDate: "2026-01-01",
  endDate: "2026-06-30",
  totalLogs: 0,
  topType: "movie",
  topPlace: "-",
  topOccasion: "-",
  doneRatePct: 0,
  noteFillPct: 0,
  posters: [],
};
const cases = [
  { name: "empty-ko-desktop", width: 1440, enabled: [] },
  { name: "empty-en-mobile", locale: "en", enabled: [] },
  { name: "older-records-only", report: { totalLogs: 8 }, enabled: [] },
  {
    name: "previous-week-only",
    report: { totalLogs: 2, previousWeekLogs: 2 },
    enabled: ["weekly"],
  },
  {
    name: "this-month-only-no-posters-or-genres",
    locale: "en",
    report: { totalLogs: 1, thisMonthLogs: 1 },
    enabled: ["monthly"],
  },
  {
    name: "both-periods",
    report: { totalLogs: 3, previousWeekLogs: 2, thisMonthLogs: 1 },
    enabled: ["weekly", "monthly"],
  },
  {
    name: "empty-half-year",
    report: { totalLogs: 2, thisMonthLogs: 2, seasonalRecap: recap },
    enabled: ["monthly"],
  },
  {
    name: "nonempty-half-year",
    report: {
      totalLogs: 3,
      thisMonthLogs: 2,
      seasonalRecap: { ...recap, totalLogs: 1 },
    },
    enabled: ["monthly", "half-year"],
  },
  { name: "empty-local-fallback", fallback: true, enabled: [] },
].filter(
  (item) =>
    !process.env.REPORT_SHARE_QA_CASE ||
    item.name === process.env.REPORT_SHARE_QA_CASE,
);
assert.ok(cases.length);
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
const results = [];
try {
  for (const item of cases) {
    const locale = item.locale ?? "ko";
    const messages = JSON.parse(
      await readFile(
        new URL(`../messages/${locale}.json`, import.meta.url),
        "utf8",
      ),
    ).Report;
    const report = { ...empty, ...item.report };
    const context = await browser.newContext({
      viewport: { width: item.width ?? 390, height: 844 },
      locale: locale === "ko" ? "ko-KR" : "en-US",
      timezoneId: "Asia/Seoul",
      serviceWorkers: "block",
    });
    await context.addInitScript(() => {
      const NativeDate = Date;
      const fixed = NativeDate.parse("2026-07-01T12:00:00+09:00");
      window.Date = class extends NativeDate {
        constructor(...args) {
          super(...(args.length ? args : [fixed]));
        }
        static now() {
          return fixed;
        }
      };
      localStorage.setItem(
        "watchlog.userId",
        "00000000-0000-4000-8000-000000000001",
      );
      localStorage.setItem(
        "watchlog.deviceId",
        "00000000-0000-4000-8000-000000000002",
      );
      localStorage.setItem("watchlog.pairingCode", "REPORT-QA");
      window.reportShareCalls = 0;
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async () => {
          window.reportShareCalls++;
        },
      });
    });
    const cards = [],
      errors = [];
    await context.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/nalytic/me/report")
        return route.fulfill(
          item.fallback
            ? { status: 503, json: { message: "Isolated fallback" } }
            : { json: report },
        );
      if (route.request().method() !== "GET")
        return route.fulfill({ status: 204 });
      if (path === "/api/auth/profile")
        return route.fulfill({
          json: {
            userId: "00000000-0000-4000-8000-000000000001",
            nickname: null,
            personaKey: null,
          },
        });
      if (path === "/api/sync/pull")
        return route.fulfill({
          json: {
            serverTime: new Date().toISOString(),
            changes: { logs: [], titles: [] },
          },
        });
      return route.fulfill({ json: [] });
    });
    await context.route("**/og/share-card", (route) => {
      cards.push(route.request().postDataJSON());
      return route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jzQAAAABJRU5ErkJggg==",
          "base64",
        ),
      });
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`${base.origin}/${locale}/me/report`, {
        waitUntil: "domcontentloaded",
      });
      const actions = {
        weekly: messages.weeklyShareAction,
        monthly: messages.monthlyShareAction,
        "half-year": messages.h1ShareAction,
      };
      const weekly = page.getByRole("button", {
        name: actions.weekly,
        exact: true,
      });
      await weekly.waitFor();
      for (const [kind, label] of Object.entries(actions)) {
        const button = page.getByRole("button", { name: label, exact: true });
        if (kind === "half-year" && !report.seasonalRecap) {
          assert.equal(await button.count(), 0);
          continue;
        }
        const enabled = item.enabled.includes(kind);
        assert.equal(
          await button.isDisabled(),
          !enabled,
          `${item.name}: ${kind} must be ${enabled ? "enabled" : "disabled"} for this period`,
        );
        const count = cards.length;
        if (!enabled) {
          await button.dispatchEvent("click");
          assert.equal(
            cards.length,
            count,
            "Empty periods cannot render a card",
          );
        } else {
          await button.click();
          await page.waitForFunction(
            (expected) => window.reportShareCalls === expected,
            count + 1,
          );
          assert.equal(cards.length, count + 1);
          assert.equal(cards.at(-1).recapKind, kind);
          await button.waitFor();
        }
      }
      assert.deepEqual(errors, []);
      results.push({
        name: item.name,
        generatedKinds: cards.map((card) => card.recapKind),
      });
      console.log(`PASS ${item.name}`);
    } catch (error) {
      await page.screenshot({
        path: join(output, `${item.name}-failure.png`),
        fullPage: true,
      });
      await writeFile(
        join(output, `${item.name}-failure.json`),
        JSON.stringify({ error: String(error), cards, errors }, null, 2),
      );
      throw error;
    } finally {
      await context.close();
    }
  }
  await writeFile(
    join(output, "results.json"),
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser.close();
}
