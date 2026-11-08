/** Pair through the real UI, then open Home without visiting Timeline.
 * Isolated API responses only: no real pairing, records, or public writes.
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
  process.env.PAIRING_HOME_QA_OUTPUT ?? join(tmpdir(), "ottline-pairing-home");
await mkdir(output, { recursive: true });
const existingIdentity = process.env.PAIRING_HOME_EXISTING_IDENTITY === "1";
const syncFailure = process.env.PAIRING_HOME_SYNC_FAILURE === "1";
const auth = {
  userId: "00000000-0000-4000-8000-000000000001",
  deviceId: "00000000-0000-4000-8000-000000000002",
  pairingCode: "ISOLATED-PC-CODE",
};
const records = Array.from({ length: 9 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 10, 7 - i, 0)).toISOString();
  return {
    id: `paired-log-${i}`,
    titleId: `paired-title-${i}`,
    title: {
      id: `paired-title-${i}`,
      name: i >= 8 ? `Read on PC ${i}` : `Ongoing on PC ${i}`,
      type: "book",
      provider: "KAKAO",
      providerId: `isolated-${i}`,
    },
    status: i >= 8 ? "DONE" : i % 2 ? "WISHLIST" : "IN_PROGRESS",
    watchedAt: date,
    createdAt: date,
    updatedAt: date,
    origin: "LOG",
    spoiler: false,
    place: "HOME",
    occasion: "ALONE",
    syncStatus: "synced",
  };
});
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  args: ["--no-sandbox"],
});
const requests = [],
  errors = [];
let page,
  paired = false,
  blockPairedPull = syncFailure;
const started = Date.now();
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    serviceWorkers: "block",
  });
  if (existingIdentity) {
    await context.addInitScript(() => {
      if (localStorage.getItem("watchlog.userId")) return;
      localStorage.setItem(
        "watchlog.userId",
        "00000000-0000-4000-8000-000000000003",
      );
      localStorage.setItem(
        "watchlog.deviceId",
        "00000000-0000-4000-8000-000000000004",
      );
      localStorage.setItem("watchlog.pairingCode", "ISOLATED-OLD-CODE");
      localStorage.setItem("watchlog.lastSyncAt", new Date().toISOString());
    });
  }
  await context.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    requests.push({
      path: url.pathname + url.search,
      method: request.method(),
      identity:
        request.headers()["x-user-id"] === auth.userId
          ? "paired"
          : "previous-or-none",
      ms: Date.now() - started,
    });
    if (url.pathname === "/api/auth/pair" && request.method() === "POST") {
      paired = true;
      return route.fulfill({ json: auth });
    }
    if (request.method() !== "GET") return route.fulfill({ status: 204 });
    if (url.pathname === "/api/auth/profile")
      return route.fulfill({
        json: {
          userId: auth.userId,
          nickname: null,
          personaKey: "cinema_keeper",
        },
      });
    if (url.pathname === "/api/auth/devices")
      return route.fulfill({
        json: paired
          ? [
              {
                id: auth.deviceId,
                userAgent: "Isolated mobile",
                createdAt: new Date().toISOString(),
                lastSeenAt: new Date().toISOString(),
              },
            ]
          : [],
      });
    if (url.pathname === "/api/logs") {
      let items = paired ? records : [];
      if (url.searchParams.get("status"))
        items = items.filter(
          (item) => item.status === url.searchParams.get("status"),
        );
      const limit = Number(url.searchParams.get("limit") || 100);
      return route.fulfill({ json: items.slice(0, limit) });
    }
    if (url.pathname === "/api/logs/page") {
      let items = paired ? records : [];
      if (url.searchParams.get("status"))
        items = items.filter(
          (item) => item.status === url.searchParams.get("status"),
        );
      return route.fulfill({ json: { items, nextCursor: null } });
    }
    if (url.pathname === "/api/sync/pull") {
      const pairedRequest = request.headers()["x-user-id"] === auth.userId;
      if (pairedRequest && blockPairedPull)
        return route.fulfill({
          status: 503,
          json: { message: "Isolated initial pull failure" },
        });
      const since = url.searchParams.get("since");
      const changes = pairedRequest
        ? records.filter(
            (log) => !since || new Date(log.updatedAt) > new Date(since),
          )
        : [];
      return route.fulfill({
        json: {
          serverTime: new Date().toISOString(),
          changes: {
            logs: changes,
            titles: changes.map((log) => log.title),
          },
        },
      });
    }
    return route.fulfill({ json: [] });
  });
  page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base.origin}/account`, { waitUntil: "domcontentloaded" });
  await page.locator("#pairing-code").fill(auth.pairingCode);
  await page
    .locator("form")
    .filter({ has: page.locator("#pairing-code") })
    .getByRole("button")
    .click();
  await page
    .getByText(
      syncFailure
        ? "기기는 연결됐어요. 아직 동기화를 마치지 못했어요. 연결 상태를 확인하고 홈을 다시 열어 주세요."
        : "기록이 연결됐어요. 같은 타임라인을 이어볼 수 있어요.",
      {
        exact: true,
      },
    )
    .waitFor();
  assert.ok(paired);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("watchlog.userId")),
    auth.userId,
    "a failed initial pull must keep the successful device connection",
  );
  if (!syncFailure) {
    const cachedIds = await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open("watchlog");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const read = db
              .transaction("logs", "readonly")
              .objectStore("logs")
              .getAllKeys();
            read.onerror = () => reject(read.error);
            read.onsuccess = () => {
              db.close();
              resolve(read.result);
            };
          };
        }),
    );
    assert.ok(
      cachedIds.includes("paired-log-8"),
      "connection success must wait for older completed records to be cached",
    );
  }
  blockPairedPull = false;
  await page.locator('a[href="/"]:visible').first().click();
  await page
    .locator(
      '[data-testid="home-featured"], [data-testid="home-completed-month-empty"], [data-testid="home-first-record"]',
    )
    .first()
    .waitFor();
  const deadline = Date.now() + 1500;
  while (
    Date.now() < deadline &&
    (await page.getByTestId("home-featured").count()) === 0
  )
    await new Promise((resolve) => setTimeout(resolve, 50));
  const beforeTimeline = (await page.getByTestId("home-featured").count()) > 0;
  await page.screenshot({
    path: join(output, "home-immediately-after-pairing.png"),
  });
  if (!beforeTimeline) {
    await page.goto(`${base.origin}/timeline`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByTestId("timeline-record")
      .filter({ hasText: "Read on PC 8" })
      .waitFor();
    await page.locator('a[href="/"]:visible').first().click();
    await page.getByTestId("home-featured").waitFor();
    const result = {
      result: "FAIL",
      existingIdentity,
      homeDirectlyAfterPairing: false,
      homeAfterTimelineVisit: true,
      requests,
      errors,
    };
    await writeFile(
      join(output, "result.json"),
      JSON.stringify(result, null, 2),
    );
    console.error(JSON.stringify(result));
    assert.fail(
      "Paired device Home omits completed records until Timeline is visited",
    );
  }
  assert.match(
    await page.getByTestId("home-featured").innerText(),
    /Read on PC/,
  );
  assert.deepEqual(errors, []);
  const result = {
    result: "PASS",
    existingIdentity,
    syncFailure,
    homeDirectlyAfterPairing: true,
    timelineVisited: false,
    requests,
    errors,
    actualApiWrites: 0,
  };
  await writeFile(join(output, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  await context.close();
} finally {
  await browser.close();
}
