import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const externalBaseURL = process.env.TIMELINE_TEST_URL;
const baseURL = externalBaseURL ?? "http://127.0.0.1:3210";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));

const webDirectory = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
let server;
let serverOutput = "";

function captureServerOutput(chunk) {
  serverOutput = `${serverOutput}${chunk}`.slice(-8000);
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server?.exitCode != null || server?.signalCode != null) {
      throw new Error(`Timeline test server exited early:\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${baseURL}/en/timeline`, {
        redirect: "manual",
      });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timeline test server did not start:\n${serverOutput}`);
}

async function stopServer() {
  if (!server || server.exitCode != null || server.signalCode != null) return;
  server.kill("SIGTERM");
  await Promise.race([
    once(server, "exit"),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (server.exitCode == null && server.signalCode == null) {
    const exited = once(server, "exit");
    server.kill("SIGKILL");
    await exited;
  }
}

if (!externalBaseURL) {
  const nextBin = require.resolve("next/dist/bin/next");
  server = spawn(
    process.execPath,
    [nextBin, "dev", "--hostname", "127.0.0.1", "--port", "3210"],
    {
      cwd: webDirectory,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", captureServerOutput);
  server.stderr.on("data", captureServerOutput);
}

function fixture(count) {
  return Array.from({ length: count }, (_, i) => {
    const id = String(i).padStart(3, "0");
    const date = new Date(Date.UTC(2026, 8, 14 - i)).toISOString();
    return {
      id: `log-${id}`,
      titleId: `title-${id}`,
      title: {
        id: `title-${id}`,
        name: `Scroll record ${id}`,
        type: i % 2 ? "book" : "movie",
      },
      status: "DONE",
      origin: "LOG",
      spoiler: false,
      watchedAt: date,
      createdAt: date,
      updatedAt: date,
      syncStatus: "synced",
    };
  });
}

let browser;
try {
  if (server) await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
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
      localStorage.setItem("watchlog.pairingCode", "TESTCODE");
      localStorage.setItem("watchlog.lastSyncAt", "2026-09-14T00:00:00.000Z");
    } catch {}
  });
  const page = await context.newPage();
  let serverLogs = fixture(125);
  const requestedCursors = [];
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/logs/page") {
      const cursor = url.searchParams.get("cursor");
      requestedCursors.push(cursor);
      const offset = cursor ? Number(cursor.replace("cursor-", "")) : 0;
      const limit = Number(url.searchParams.get("limit"));
      assert.equal(limit, 50);
      assert.equal(url.searchParams.get("sort"), "history");
      const items = serverLogs.slice(offset, offset + limit);
      const nextOffset = offset + items.length;
      return route.fulfill({
        json: {
          items,
          nextCursor:
            nextOffset < serverLogs.length ? `cursor-${nextOffset}` : null,
        },
      });
    }
    if (url.pathname === "/api/sync/pull") {
      return route.fulfill({
        json: {
          serverTime: "2026-09-14T00:00:01.000Z",
          changes: { logs: [], titles: [] },
        },
      });
    }
    return route.fulfill({ json: {} });
  });

  async function clearLocalLogs() {
    await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("watchlog");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction("logs", "readwrite");
        tx.objectStore("logs").clear();
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    });
  }

  const cards = () => page.getByRole("link", { name: /^Scroll record / });
  async function countIs(count) {
    try {
      await page.waitForFunction(
        (expected) =>
          [...document.querySelectorAll("a")].filter((link) =>
            /^Scroll record /.test(link.textContent.trim()),
          ).length === expected,
        count,
        { timeout: 6000 },
      );
    } catch (error) {
      console.error("Timeline page requests:", requestedCursors);
      console.error(
        "Timeline page text:",
        (await page.locator("body").innerText()).slice(0, 2000),
      );
      throw error;
    }
    assert.equal(await cards().count(), count);
  }

  await page.goto(`${baseURL}/en/timeline`);
  await countIs(50);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await countIs(100);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await countIs(125);
  assert.equal(new Set(await cards().allTextContents()).size, 125);
  assert.deepEqual([...new Set(requestedCursors)].slice(0, 3), [
    null,
    "cursor-50",
    "cursor-100",
  ]);

  await page.reload();
  await countIs(50);
  await context.setOffline(true);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await countIs(100);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await countIs(125);

  await page.getByRole("textbox").fill("Scroll record 124");
  await countIs(1);
  assert.match(await cards().first().innerText(), /Scroll record 124/);

  await context.setOffline(false);
  serverLogs = fixture(75);
  await clearLocalLogs();
  await context.addInitScript(() => {
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      value: undefined,
    });
  });
  await page.reload();
  await countIs(50);
  await page.getByRole("button", { name: "Show earlier logs" }).click();
  await countIs(75);

  serverLogs = fixture(50);
  await clearLocalLogs();
  await page.reload();
  await countIs(50);
  assert.equal(
    await page.getByRole("button", { name: "Show earlier logs" }).count(),
    0,
  );

  serverLogs = fixture(51);
  await clearLocalLogs();
  await page.reload();
  await countIs(50);
  await page.getByRole("button", { name: "Show earlier logs" }).click();
  await countIs(51);

  await page.setViewportSize({ width: 1280, height: 900 });
  serverLogs = fixture(125);
  await clearLocalLogs();
  await page.reload();
  await countIs(50);
  await page.getByRole("button", { name: "Show earlier logs" }).click();
  await countIs(100);

  console.log(
    "PASS: server cursors, offline cache, 50/51 boundaries, search, and responsive fallback work",
  );
} catch (error) {
  if (serverOutput) console.error(serverOutput);
  throw error;
} finally {
  await browser?.close();
  await stopServer();
}
