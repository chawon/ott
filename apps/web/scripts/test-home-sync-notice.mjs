/**
 * Rendered home + real IndexedDB, with ALL /api requests intercepted.
 * No existing account, real registration, or public API writes are used.
 * WEB_RUNTIME_URL defaults to loopback :4173. Optional PLAYWRIGHT_EXECUTABLE_PATH.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:4173");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
const searchedTitle = {
  provider: "TMDB",
  providerId: "27205",
  type: "movie",
  name: "홈 동기화 검증",
  year: 2010,
  genres: ["SF"],
};

async function poll(label, read, accept, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await read();
    if (accept(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out: ${label}`);
}

async function snapshot(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("watchlog");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const result = {};
          const tx = db.transaction(["logs", "outbox"], "readonly");
          for (const name of ["logs", "outbox"]) {
            const read = tx.objectStore(name).getAll();
            read.onsuccess = () => {
              result[name] = read.result;
            };
          }
          tx.oncomplete = () => {
            db.close();
            resolve(result);
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
}

const context = await browser.newContext({
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  serviceWorkers: "block",
});
const state = { failPush: true, pushes: 0, log: null, title: null, errors: [] };
await context.addInitScript(() => {
  localStorage.setItem(
    "watchlog.userId",
    "30000000-0000-4000-8000-000000000002",
  );
  localStorage.setItem(
    "watchlog.deviceId",
    "40000000-0000-4000-8000-000000000002",
  );
  localStorage.setItem("watchlog.pairingCode", "ISOLATED-TEST-CODE");
});
await context.route("**/*", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (!url.pathname.startsWith("/api/"))
    return url.origin === base.origin ? route.continue() : route.abort();
  const path = url.pathname.slice(4);
  const reply = (data, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  if (path === "/titles/search")
    return reply(
      url.searchParams.get("type") === "book" ? [] : [searchedTitle],
    );
  if (
    path === "/titles/popular" ||
    path.startsWith("/discussions") ||
    path === "/auth/devices"
  )
    return reply([]);
  if (path.startsWith("/tmdb/"))
    return reply({ genres: ["SF"], directors: [], cast: [] });
  if (path === "/sync/push") {
    state.pushes += 1;
    if (state.failPush)
      return reply({ message: "Temporary sync service failure" }, 503);
    const body = request.postDataJSON();
    for (const change of body.changes.titles)
      state.title = {
        ...change.payload,
        id: change.id,
        updatedAt: change.updatedAt,
      };
    for (const change of body.changes.logs)
      state.log = {
        ...change.payload,
        id: change.id,
        createdAt: change.updatedAt,
        updatedAt: change.updatedAt,
      };
    return reply({
      accepted: body.changes.logs.map((item) => item.id),
      rejected: [],
    });
  }
  if (path === "/sync/pull")
    return reply({
      serverTime: new Date().toISOString(),
      changes: {
        titles: state.title ? [state.title] : [],
        logs: state.log ? [state.log] : [],
      },
    });
  if (path === "/logs")
    return reply(state.log ? [{ ...state.log, title: state.title }] : []);
  return reply({});
});
const page = await context.newPage();
page.on("pageerror", (error) => state.errors.push(error.message));

try {
  await page.goto(`${base.origin}/ko?quick=1`);
  await page.getByTestId("title-search").fill(searchedTitle.name);
  await page.getByTestId("title-search-result").first().click();
  await page.getByTestId("record-status-DONE").click();
  await page.getByTestId("record-save-initial").click();
  await poll(
    "failed sync retained locally",
    () => snapshot(page),
    (data) => data.logs[0]?.syncStatus === "failed" && data.outbox.length === 1,
  );
  await page.getByTestId("record-done").click();
  const notice = page
    .locator('aside[role="status"]')
    .filter({ hasText: /기록/ });
  await notice.waitFor();
  const evidence = {
    online: await page.evaluate(() => navigator.onLine),
    syncStatus: (await snapshot(page)).logs[0].syncStatus,
    push503s: state.pushes,
    notice: await notice.innerText(),
  };
  console.log(JSON.stringify(evidence));
  assert.equal(evidence.online, true);
  assert.equal(evidence.syncStatus, "failed");
  assert.doesNotMatch(
    evidence.notice,
    /인터넷에 연결되면|연결 상태를 확인/,
    "An online server failure must not be described as missing internet",
  );
  console.log("PASS online failed sync notice");
  assert.deepEqual(state.errors, []);
} finally {
  await context.close();
  await browser.close();
}
