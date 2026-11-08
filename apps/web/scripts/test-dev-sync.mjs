/**
 * First record -> real API sync -> devices -> second device, using the actual browser origin.
 * Writes only fresh private test accounts/records. Does not publish, delete, or use existing accounts.
 * WEB_RUNTIME_URL is required; a private LAN origin also requires SYNC_QA_ALLOW_LAN=1.
 * SYNC_QA_ALLOW_TUNNEL=1 permits only an HTTPS ngrok URL owned by the local agent and routed to :3000.
 * SYNC_QA_BLOCK_REGISTRATION=1 first holds registration unavailable, then verifies UI retry.
 */
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

// Set the same origin (including its port) that the user opens in their browser.
assert.ok(
  process.env.WEB_RUNTIME_URL,
  "WEB_RUNTIME_URL must explicitly name the browser test origin",
);
const target = new URL(process.env.WEB_RUNTIME_URL);
const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
const octets = target.hostname.split(".").map(Number);
const privateLan =
  isIP(target.hostname) === 4 &&
  (octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168));
let localTunnel = false;
if (
  process.env.SYNC_QA_ALLOW_TUNNEL === "1" &&
  target.protocol === "https:" &&
  [".ngrok-free.dev", ".ngrok-free.app"].some((suffix) =>
    target.hostname.endsWith(suffix),
  )
) {
  const agent = await fetch("http://127.0.0.1:4040/api/tunnels", {
    signal: AbortSignal.timeout(3000),
  });
  assert.ok(agent.ok, "The local ngrok agent must confirm the test origin");
  const { tunnels } = await agent.json();
  localTunnel = tunnels.some((tunnel) => {
    if (tunnel.public_url !== target.origin || !tunnel.config?.addr)
      return false;
    const upstream = new URL(tunnel.config.addr);
    return (
      upstream.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(upstream.hostname) &&
      upstream.port === "3000"
    );
  });
}
assert.ok(
  (target.protocol === "http:" &&
    (loopback || (privateLan && process.env.SYNC_QA_ALLOW_LAN === "1"))) ||
    localTunnel,
  "Only local development origins or an explicitly confirmed local ngrok tunnel are allowed",
);
assert.ok(
  !target.username &&
    !target.password &&
    target.pathname === "/" &&
    !target.search &&
    !target.hash,
);
const base = target.origin;
const output = await mkdtemp(join(tmpdir(), "ottline-dev-sync-"));
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  args: ["--no-sandbox"],
  headless: true,
});
const network = [];
const errors = [];
let stage = "startup";
let blockRegistration = process.env.SYNC_QA_BLOCK_REGISTRATION === "1";
async function poll(label, read, accept, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await read();
    if (accept(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out: ${label}`);
}
async function ownGet(page, path) {
  return page.evaluate(async (path) => {
    const user = localStorage.getItem("watchlog.userId");
    const device = localStorage.getItem("watchlog.deviceId");
    if (!user || !device) return null;
    const response = await fetch(`/api${path}`, {
      headers: { "X-User-Id": user, "X-Device-Id": device },
      cache: "no-store",
    });
    return { status: response.status, body: await response.json() };
  }, path);
}
async function local(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("watchlog");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(["logs", "outbox"], "readonly");
          const result = {};
          for (const store of ["logs", "outbox"]) {
            const read = tx.objectStore(store).getAll();
            read.onsuccess = () => {
              result[store] = read.result;
            };
          }
          tx.oncomplete = () => {
            db.close();
            resolve(result);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}
async function context() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "ko-KR",
    serviceWorkers: "block",
    extraHTTPHeaders: localTunnel ? { "ngrok-skip-browser-warning": "1" } : {},
  });
  await context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      /googletagmanager|google-analytics|clarity\.ms|cloudflareinsights/.test(
        url.hostname,
      )
    )
      return route.abort();
    if (url.pathname === "/api/auth/register" && blockRegistration)
      return route.fulfill({
        status: 503,
        json: {
          message: "Registration temporarily unavailable in this isolated test",
        },
      });
    if (
      request.method() !== "GET" &&
      /\/api\/(nalytic|analytics)\//.test(url.pathname)
    )
      return route.fulfill({ status: 204 });
    if (
      ["DELETE"].includes(request.method()) ||
      (request.method() !== "GET" &&
        /\/api\/(discussions|feedback)/.test(url.pathname))
    )
      throw new Error("Public writes and deletion are forbidden in this check");
    return route.continue();
  });
  return context;
}
let page;
try {
  const primaryContext = await context();
  page = await primaryContext.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (/\/api\/(auth|sync)\//.test(url.pathname))
      network.push({
        path: url.pathname,
        method: response.request().method(),
        status: response.status(),
      });
  });
  await page.goto(`${base}/ko?quick=1`);
  stage = "search";
  await page.getByTestId("title-search").fill("인셉션");
  await page.getByRole("button", { name: "영화", exact: true }).click();
  await page.getByTestId("title-search-result").first().click();
  stage = "save";
  await page.getByTestId("record-status-DONE").click();
  await page.getByTestId("record-save-initial").click();
  await page.getByTestId("record-done").waitFor();
  await page.getByTestId("record-done").click();
  if (blockRegistration) {
    stage = "pending record";
    await page.getByTestId("home-sync-notice").waitFor();
    const pending = await local(page);
    assert.equal(pending.logs.length, 1);
    assert.equal(pending.outbox.length, 1);
    blockRegistration = false;
    await page.getByTestId("home-sync-retry").click();
  }
  stage = "server sync";
  const snapshot = await poll(
    "outbox drained and record synced",
    () => local(page),
    (value) =>
      value.logs.length === 1 &&
      value.logs[0].syncStatus === "synced" &&
      value.outbox.length === 0,
  );
  const records = await ownGet(page, "/logs");
  assert.equal(records?.status, 200);
  assert.ok(records.body.some((record) => record.id === snapshot.logs[0].id));
  const devices = await ownGet(page, "/auth/devices");
  assert.equal(devices?.status, 200);
  assert.equal(devices.body.length, 1);
  assert.equal(await page.getByTestId("home-sync-notice").count(), 0);
  stage = "device screen";
  await page.goto(`${base}/ko/account`);
  await page.locator("#main-content h1").waitFor();
  await page.getByText("현재 기기", { exact: true }).waitFor();
  await page.screenshot({
    path: `${output}/devices.png`,
    mask: [page.locator("main code, main input[readonly]")],
  });
  const code = await page.evaluate(() =>
    localStorage.getItem("watchlog.pairingCode"),
  );
  assert.ok(code);
  stage = "second device";
  const secondaryContext = await context();
  const secondary = await secondaryContext.newPage();
  await secondary.setViewportSize({ width: 390, height: 844 });
  await secondary.goto(`${base}/ko/account`);
  await secondary.locator("#pairing-code").fill(code);
  await secondary
    .locator("form")
    .filter({ has: secondary.locator("#pairing-code") })
    .getByRole("button")
    .click();
  await secondary
    .getByText("기록이 연결됐어요. 같은 타임라인을 이어볼 수 있어요.", {
      exact: true,
    })
    .waitFor();
  assert.ok(
    (await local(secondary)).logs.some(
      (record) => record.id === snapshot.logs[0].id,
    ),
    "paired records must be cached before connection success",
  );
  await secondary.locator('a[href="/"]:visible').first().click();
  await secondary.getByTestId("home-featured").waitFor();
  const secondRecords = await ownGet(secondary, "/logs");
  assert.equal(secondRecords.status, 200);
  assert.ok(
    secondRecords.body.some((record) => record.id === snapshot.logs[0].id),
  );
  const secondDevices = await ownGet(secondary, "/auth/devices");
  assert.equal(secondDevices.body.length, 2);
  await page.goto(`${base}/ko`);
  assert.equal(await page.getByTestId("home-sync-notice").count(), 0);
  assert.deepEqual(errors, []);
  const result = {
    result: "PASS",
    base,
    pendingRetry: process.env.SYNC_QA_BLOCK_REGISTRATION === "1",
    records: records.body.length,
    devices: secondDevices.body.length,
    network,
    errors,
  };
  await writeFile(
    `${output}/result-${new URL(base).port || "tunnel"}-${process.env.SYNC_QA_BLOCK_REGISTRATION ?? "0"}.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  await primaryContext.close();
  await secondaryContext.close();
} catch (error) {
  console.error(
    JSON.stringify({ result: "FAIL", base, stage, network, errors }),
  );
  if (page)
    await page
      .screenshot({
        path: `${output}/failure-${new URL(base).port || "tunnel"}.png`,
      })
      .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
