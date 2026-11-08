/** Home's monthly memories show DONE; other statuses stay in their own areas.
 * All API requests use isolated responses; no actual account or record is changed.
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
  process.env.HOME_MONTH_QA_OUTPUT ??
  join(tmpdir(), "ottline-home-completed-months");
await mkdir(output, { recursive: true });
function record(id, status, date, type = "movie", extra = {}) {
  return {
    id,
    titleId: `title-${id}`,
    title: {
      id: `title-${id}`,
      name: id,
      type,
      provider: "TMDB",
      providerId: id,
    },
    status,
    origin: "LOG",
    watchedAt: date,
    createdAt: date,
    updatedAt: date,
    spoiler: false,
    place: "HOME",
    occasion: "ALONE",
    syncStatus: "synced",
    ...extra,
  };
}
const mixed = [
  record("wishlist-november", "WISHLIST", "2026-11-07T12:00:00Z", "book"),
  record("ongoing-november", "IN_PROGRESS", "2026-11-06T12:00:00Z", "series"),
  record("read-november", "DONE", "2026-11-05T12:00:00Z", "book"),
  record("watched-november", "DONE", "2026-11-04T12:00:00Z"),
  ...Array.from({ length: 7 }, (_, i) =>
    record(
      `watched-extra-${i}`,
      "DONE",
      new Date(Date.UTC(2026, 10, 3, 12, 0, i)).toISOString(),
    ),
  ),
  record("read-october", "DONE", "2026-10-31T12:00:00Z", "book"),
  record("ongoing-september", "IN_PROGRESS", "2026-09-03T12:00:00Z"),
  record("wishlist-august", "WISHLIST", "2026-08-12T12:00:00Z", "book"),
];
const scenarios = [
  ["mixed", mixed],
  ["only-ongoing", mixed.filter((log) => log.status === "IN_PROGRESS")],
  ["only-wishlist", mixed.filter((log) => log.status === "WISHLIST")],
  [
    "pending-ongoing",
    [
      record("pending-ongoing", "IN_PROGRESS", "2026-11-06T12:00:00Z", "book", {
        syncStatus: "pending",
      }),
    ],
  ],
  ["no-records", []],
];
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
const cases = [],
  errors = [];
let page;
async function waitUntil(read, accept, label) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (accept(await read())) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(label);
}
async function putLocal(p, logs) {
  await p.evaluate(
    (items) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("watchlog");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(["logs", "titles"], "readwrite");
          for (const log of items) {
            tx.objectStore("titles").put(log.title);
            tx.objectStore("logs").put(log);
          }
          tx.oncomplete = () => {
            db.close();
            window.dispatchEvent(new CustomEvent("sync:updated"));
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    logs,
  );
}
try {
  for (const [locale, width] of [
    ["ko", 1440],
    ["en", 390],
  ]) {
    for (const [name, logs] of scenarios) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        locale: locale === "ko" ? "ko-KR" : "en-US",
        timezoneId: "Asia/Seoul",
        serviceWorkers: "block",
      });
      await context.addInitScript(() => {
        try {
          localStorage.setItem(
            "watchlog.userId",
            "00000000-0000-4000-8000-000000000001",
          );
          localStorage.setItem(
            "watchlog.deviceId",
            "00000000-0000-4000-8000-000000000002",
          );
          localStorage.setItem("watchlog.pairingCode", "ISOLATED-QA");
          localStorage.setItem("watchlog.lastSyncAt", new Date().toISOString());
        } catch {}
      });
      await context.route("**/api/**", (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (request.method() !== "GET") return route.fulfill({ status: 204 });
        if (url.pathname === "/api/logs")
          return route.fulfill({
            json: logs.slice(0, Number(url.searchParams.get("limit") || 8)),
          });
        if (url.pathname === "/api/auth/profile")
          return route.fulfill({
            json: {
              userId: "00000000-0000-4000-8000-000000000001",
              nickname: null,
              personaKey: "cinema_keeper",
            },
          });
        if (url.pathname === "/api/sync/pull")
          return route.fulfill({
            json: {
              serverTime: new Date().toISOString(),
              changes: { logs: [], titles: [] },
            },
          });
        return route.fulfill({ json: [] });
      });
      page = await context.newPage();
      page.setDefaultTimeout(12_000);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base.origin}/${locale}`, {
        waitUntil: "domcontentloaded",
      });
      await page
        .locator(
          '[data-testid="home-featured"], [data-testid="home-completed-month-empty"], [data-testid="home-first-record"]',
        )
        .first()
        .waitFor();
      if (logs.length) await putLocal(page, logs);
      const months = page.getByTestId("home-month"),
        featured = page.getByTestId("home-featured"),
        empty = page.getByTestId("home-completed-month-empty");
      const ongoing = page.locator('div[class*="continuingList"] > article');
      if (name === "mixed") {
        await waitUntil(
          () => months.count(),
          (n) => n === 2,
          "Only two months contain watched/read records",
        );
        assert.equal(
          await featured.getAttribute("data-log-id"),
          "read-november",
        );
        const entries = page.locator(
          'section[class*="monthEntries"] a[class*="entry"]',
        );
        assert.equal(await entries.count(), 6);
        for (const entry of await entries.all())
          assert.match(await entry.getAttribute("href"), /title-watched-/);
        assert.equal(await ongoing.count(), 2);
        for (const id of ["wishlist-november", "wishlist-august"])
          assert.equal(await page.getByText(id, { exact: true }).count(), 0);
        await months.nth(1).click();
        assert.equal(
          await featured.getAttribute("data-log-id"),
          "read-october",
        );
        assert.equal(await ongoing.count(), 2);
        await putLocal(page, [
          {
            ...logs.find((log) => log.id === "read-october"),
            status: "IN_PROGRESS",
          },
        ]);
        await waitUntil(
          () => months.count(),
          (n) => n === 1,
          "An empty completed month disappears after status changes",
        );
        assert.equal(
          await featured.getAttribute("data-log-id"),
          "read-november",
        );
        await waitUntil(
          () => ongoing.count(),
          (n) => n === 3,
          "Changed record moves into ongoing stories",
        );
      } else if (logs.length) {
        await empty.waitFor();
        assert.equal(await months.count(), 0);
        assert.equal(await featured.count(), 0);
        assert.equal(await page.getByTestId("home-first-record").count(), 0);
        assert.equal(await page.getByTestId("home-record").isVisible(), true);
        assert.match(
          await empty.getByRole("link").getAttribute("href"),
          /\/timeline$/,
        );
        await waitUntil(
          () => ongoing.count(),
          (n) =>
            n === logs.filter((log) => log.status === "IN_PROGRESS").length,
          "Ongoing stories remain visible without finished records",
        );
        if (name !== "only-wishlist")
          assert.ok((await page.getByTestId("home-moment-link").count()) > 0);
        if (name === "pending-ongoing")
          await page.getByTestId("home-sync-notice").waitFor();
        if (name === "only-wishlist")
          assert.ok(
            (await page.locator('a[href$="/me/bookshelf"]').count()) > 0 ||
              locale !== "ko",
          );
        assert.ok((await page.locator('a[href$="/me/report"]').count()) > 0);
      } else {
        await page.getByTestId("home-first-record").waitFor();
        assert.equal(await empty.count(), 0);
        assert.equal(await months.count(), 0);
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      if (name === "mixed" || name === "only-ongoing")
        await page.screenshot({
          path: join(output, `${locale}-${width}-${name}.png`),
        });
      cases.push({ locale, width, name });
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  const result = {
    result: "PASS",
    base: base.origin,
    cases,
    errors,
    actualApiWrites: 0,
  };
  await writeFile(join(output, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  if (page && !page.isClosed())
    await page
      .screenshot({ path: join(output, "failure.png") })
      .catch(() => {});
  console.error(
    JSON.stringify({ result: "FAIL", cases, errors, message: error.message }),
  );
  throw error;
} finally {
  await browser.close();
}
