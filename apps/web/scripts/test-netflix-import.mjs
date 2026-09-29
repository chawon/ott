import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseURL = process.env.NETFLIX_IMPORT_TEST_URL ?? "http://localhost:3211";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const webDirectory = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
let server;
let serverOutput = "";
let browser;

async function stopServer() {
  if (!server || server.exitCode != null || server.signalCode != null) return;
  server.kill("SIGTERM");
  await Promise.race([
    once(server, "exit"),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (server.exitCode == null && server.signalCode == null) {
    server.kill("SIGKILL");
    await once(server, "exit");
  }
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  let lastProbe = "no response";
  while (Date.now() < deadline) {
    if (server?.exitCode != null)
      throw new Error(`Web server exited:\n${serverOutput}`);
    try {
      const response = await fetch(`${baseURL}/account/import/netflix`, {
        signal: AbortSignal.timeout(2000),
        redirect: "manual",
      });
      lastProbe = `HTTP ${response.status} ${response.headers.get("location") ?? ""}`;
      if (response.ok) {
        assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
        return;
      }
      if (response.status >= 300 && response.status < 400) break;
    } catch (error) {
      lastProbe = `${error} (${error?.cause?.code ?? error?.cause ?? "unknown cause"})`;
      if (String(error?.cause?.code).includes("NETWORK_ACCESS_DENIED")) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Web server did not respond (${lastProbe}):\n${serverOutput}`,
  );
}

const userId = "00000000-0000-4000-8000-000000000001";
const showId = "00000000-0000-4000-8000-000000000011";
const filmId = "00000000-0000-4000-8000-000000000012";
const now = "2026-09-28T00:00:00.000Z";
const titles = [
  {
    id: showId,
    name: "A Show",
    type: "series",
    provider: "TMDB",
    providerId: "11",
  },
  {
    id: filmId,
    name: "Another Film",
    type: "movie",
    provider: "TMDB",
    providerId: "12",
  },
];
const logs = titles.map((title, index) => ({
  id: `00000000-0000-4000-8000-00000000002${index}`,
  titleId: title.id,
  title,
  status: "DONE",
  origin: "LOG",
  spoiler: false,
  watchedAt: now,
  createdAt: now,
  updatedAt: now,
  note: index === 0 ? "My original note" : null,
  rating: index === 0 ? 4.5 : null,
}));
const csv =
  "Title,Date\nA Show: 시즌 1: 1화,1/2/26\nA Show: 시즌 1: 2화,1/3/26\nAnother Film: Alternate title,1/4/26\nMystery Standup,1/5/26\n";

try {
  if (!process.env.NETFLIX_IMPORT_TEST_URL) {
    const nextBin = require.resolve("next/dist/bin/next");
    server = spawn(
      process.execPath,
      [nextBin, "start", "--hostname", "localhost", "--port", "3211"],
      {
        cwd: webDirectory,
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    for (const stream of [server.stdout, server.stderr]) {
      stream.on("data", (chunk) => {
        serverOutput = `${serverOutput}${chunk}`.slice(-8000);
      });
    }
    await waitForServer();
  }
  const englishResponse = await fetch(`${baseURL}/en/account/import/netflix`, {
    redirect: "manual",
  });
  assert.equal(englishResponse.status, 200);
  assert.equal(
    englishResponse.headers.get("x-robots-tag"),
    "noindex, nofollow",
  );

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  await context.addInitScript(
    ({ userId }) => {
      localStorage.setItem("watchlog.userId", userId);
      localStorage.setItem(
        "watchlog.deviceId",
        "00000000-0000-4000-8000-000000000002",
      );
      localStorage.setItem("watchlog.pairingCode", "TESTCODE");
    },
    { userId },
  );
  const page = await context.newPage();
  const imported = new Map();
  const posts = [];
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/sync/pull") {
      return route.fulfill({
        json: {
          serverTime: now,
          changes: {
            titles: titles.map((title) => ({ ...title, updatedAt: now })),
            logs: logs.map(({ title, ...log }) => log),
          },
        },
      });
    }
    if (url.pathname === "/api/logs/page")
      return route.fulfill({ json: { items: logs, nextCursor: null } });
    if (
      url.pathname === "/api/imports/netflix" &&
      route.request().method() === "GET"
    ) {
      return route.fulfill({ json: [...imported.values()] });
    }
    if (
      url.pathname === "/api/imports/netflix" &&
      route.request().method() === "POST"
    ) {
      const body = route.request().postDataJSON();
      posts.push(body);
      for (const row of body.rows) {
        const sourceKey = createHash("sha256")
          .update(`${row.rawTitle}\n${row.viewedOn}\n${row.occurrence}`)
          .digest("hex");
        imported.set(sourceKey, { ...row, id: sourceKey, sourceKey });
      }
      return route.fulfill({
        json: {
          received: body.rows.length,
          inserted: body.rows.length,
          alreadyImported: 0,
          linked: 3,
        },
      });
    }
    return route.fulfill({ json: {} });
  });

  await page.goto(`${baseURL}/account/import/netflix`);
  await page.waitForFunction(async () => {
    const request = indexedDB.open("watchlog");
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const count = await new Promise((resolve, reject) => {
      const tx = db.transaction("logs", "readonly");
      const countRequest = tx.objectStore("logs").count();
      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => reject(countRequest.error);
    });
    db.close();
    return count === 2;
  });

  await page.locator('input[type="file"]').setInputFiles({
    name: "NetflixViewingHistory.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByText("작품 3개 연결 확인").waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  assert.equal(
    await page
      .locator("dt")
      .filter({ hasText: "기존 기록과 연결" })
      .locator("..")
      .locator("dd")
      .innerText(),
    "2",
  );
  await page.getByText("작품 3개 연결 확인").click();
  await page.getByLabel("기존 기록에 연결").nth(1).selectOption(filmId);
  assert.equal(
    await page
      .locator("dt")
      .filter({ hasText: "기존 기록과 연결" })
      .locator("..")
      .locator("dd")
      .innerText(),
    "3",
  );

  await context.setOffline(true);
  await page.getByRole("button", { name: "시청 기록 가져오기" }).click();
  await page
    .getByText("시청 항목 4개를 이 기기에 담았어요. 연결되면 동기화됩니다.")
    .waitFor();
  assert.equal(posts.length, 0);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction(() =>
    document.body.textContent.includes("가져온 시청 내역 보기"),
  );
  await page.waitForTimeout(300);
  assert.equal(posts.length, 1);
  assert.deepEqual(
    posts[0].rows.map((row) => row.linkedTitleId),
    [showId, showId, filmId, null],
  );

  await page.goto(`${baseURL}/timeline`);
  await page.getByText("넷플릭스 시청 2건").waitFor();
  assert.match(await page.locator("body").innerText(), /My original note/);
  await page.getByRole("link", { name: "넷플릭스 시청 내역" }).click();
  await page
    .getByRole("heading", { name: "넷플릭스에서 가져온 기록" })
    .waitFor();
  await page.getByText("내 기록과 연결됨").first().waitFor();
  assert.equal(await page.getByText("내 기록과 연결됨").count(), 2);
  assert.equal(await page.getByText("별도 시청 기록").count(), 1);

  await page.goto(`${baseURL}/account/import/netflix`);
  await page.locator('input[type="file"]').setInputFiles({
    name: "NetflixViewingHistory.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByText("작품 3개 연결 확인").waitFor();
  assert.equal(
    await page
      .locator("dt")
      .filter({ hasText: "이미 가져옴" })
      .locator("..")
      .locator("dd")
      .innerText(),
    "4",
  );
  await page.getByRole("button", { name: "시청 기록 가져오기" }).click();
  await page.getByText("이 파일의 항목은 이미 가져왔어요.").waitFor();
  assert.equal(posts.length, 1);

  console.log(
    "PASS: mobile preview, manual link, offline sync, linked and separate history, repeat import",
  );
} catch (error) {
  if (serverOutput) console.error(serverOutput);
  throw error;
} finally {
  await browser?.close();
  await stopServer();
}
