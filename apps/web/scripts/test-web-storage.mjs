import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3000");
assert.ok(
  baseUrl.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(baseUrl.hostname),
  "Storage verification must use a local server",
);
const profileDirectory = process.env.WEB_STORAGE_PROFILE_DIR;
assert.ok(profileDirectory?.startsWith("/tmp/ott-web-storage-"));
const seed = process.argv.includes("--seed");
const record = {
  id: "dependency-storage-log",
  titleId: "dependency-storage-title",
  title: {
    id: "dependency-storage-title",
    name: "Dependency storage record",
    type: "movie",
  },
  status: "DONE",
  rating: 4.5,
  note: "Keep this manual note through the library update.",
  origin: "LOG",
  spoiler: false,
  watchedAt: "2026-10-07T10:00:00.000Z",
  createdAt: "2026-10-07T10:00:00.000Z",
  updatedAt: "2026-10-07T10:00:00.000Z",
  syncStatus: "synced",
};

const context = await chromium.launchPersistentContext(profileDirectory, {
  headless: true,
  viewport: { width: 390, height: 844 },
  serviceWorkers: "block",
});
try {
  await context.addInitScript(() => {
    localStorage.setItem("watchlog.userId", "dependency-storage-user");
    localStorage.setItem("watchlog.deviceId", "dependency-storage-device");
    localStorage.setItem("watchlog.pairingCode", "TESTCODE");
    localStorage.setItem("watchlog.lastSyncAt", "2026-10-07T10:00:00.000Z");
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/sync/push") return route.abort();
    if (path === "/api/logs/page") {
      return route.fulfill({
        json: { items: seed ? [record] : [], nextCursor: null },
      });
    }
    if (path === "/api/sync/pull") {
      return route.fulfill({
        json: {
          serverTime: record.updatedAt,
          changes: { logs: [], titles: [] },
        },
      });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto(new URL("/en/timeline", baseUrl).href);
  const card = page.getByRole("link", { name: /^Dependency storage record/ });
  await card.waitFor();

  const snapshot = await page.evaluate(
    async ({ seed, record }) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("watchlog");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const item = {
        id: "dependency-storage-outbox",
        type: "update_log",
        logId: record.id,
        payload: { log: record },
        createdAt: record.createdAt,
        attempts: 0,
      };
      if (seed) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction("outbox", "readwrite");
          tx.objectStore("outbox").put(item);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      }
      const get = (store, key) =>
        new Promise((resolve, reject) => {
          const request = db.transaction(store).objectStore(store).get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      const result = {
        version: db.version,
        log: await get("logs", record.id),
        outbox: await get("outbox", item.id),
      };
      db.close();
      return result;
    },
    { seed, record },
  );
  assert.equal(
    snapshot.version,
    30,
    "Existing IndexedDB schema version is preserved",
  );
  for (const field of ["id", "note", "rating", "watchedAt", "status"]) {
    assert.equal(snapshot.log[field], record[field]);
    assert.equal(snapshot.outbox.payload.log[field], record[field]);
  }
  assert.equal(snapshot.outbox.type, "update_log");

  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await card.isVisible());
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const box = await card.boundingBox();
    assert.ok(box.width > 100 && box.x >= 0 && box.x + box.width <= width);
    if (process.env.WEB_STORAGE_ARTIFACT_DIR) {
      await page.screenshot({
        path: `${process.env.WEB_STORAGE_ARTIFACT_DIR}/storage-${seed ? "before" : "after"}-${width}.png`,
      });
    }
  }
  await context.setOffline(true);
  await page.getByRole("textbox").first().fill("Dependency storage");
  await card.waitFor();
  await context.setOffline(false);
  await page.reload();
  await card.waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: persisted IndexedDB log/outbox, manual fields, offline search, reload and responsive layout",
  );
} finally {
  await context.close();
}
