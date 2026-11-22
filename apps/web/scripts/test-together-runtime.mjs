/** Real production UI with an isolated local API; no production data is read or written. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const buildRoot = path.resolve(process.env.TOGETHER_WEB_BUILD_ROOT ?? webRoot);
await readFile(path.join(buildRoot, ".next", "BUILD_ID"));
const output =
  process.env.TOGETHER_QA_OUTPUT ?? path.join(tmpdir(), "ottline-together-qa");
await mkdir(output, { recursive: true });
const now = "2026-11-22T01:00:00.000Z";
const userId = "30000000-0000-4000-8000-000000000031";
const deviceId = "40000000-0000-4000-8000-000000000031";
const ids = [
  "77d5f520-100a-47e2-93c3-d229ee5f2d62",
  "320d9980-b09d-45b0-916f-3be62aca4baf",
  "294c8d04-8d10-4810-b3cd-973cc6f51079",
];
const stories = Array.from({ length: 63 }, (_, index) => ({
  id:
    ids[index] ?? `50000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  titleId: `10000000-0000-4000-8000-${String(index + 31).padStart(12, "0")}`,
  titleName:
    ["꿀알바", "Dune", "Project Hail Mary"][index] ??
    `Journey ${String(index).padStart(2, "0")}`,
  titleType: index === 0 ? "series" : "movie",
  titleYear: 2026,
  posterUrl: null,
  commentCount: index + 1,
  createdAt: new Date(Date.parse(now) - index * 60_000).toISOString(),
  reactionSummary: { done: 0, curious: 0, save: 0 },
}));
const messages = Object.fromEntries(
  await Promise.all(
    ["ko", "en"].map(async (locale) => [
      locale,
      JSON.parse(
        await readFile(
          path.join(webRoot, "messages", `${locale}.json`),
          "utf8",
        ),
      ),
    ]),
  ),
);
const requests = [];
const events = [];
const comments = new Map();
const reactions = new Map();
const statuses = new Map();
const gates = new Map();
const completedApiRequests = new Set();
let browser;
let next;
let nextOutput = "";
let base;

const backend = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const body = [];
  for await (const chunk of req) body.push(chunk);
  const data = body.length ? JSON.parse(Buffer.concat(body).toString()) : null;
  requests.push({ path: url.pathname, method: req.method, data });
  const json = (value, status = 200) => {
    if (res.destroyed) return;
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  };
  if (url.pathname === "/api/discussions/all") return json(stories);
  if (url.pathname === "/api/curated-contents")
    return json([
      {
        id: "legacy-curator-fixture",
        titleId: stories[0].titleId,
        titleName: "Legacy curator",
        titleType: "movie",
        kind: "QUESTION",
        body: "LEGACY CURATOR MUST NOT APPEAR",
        actorKey: "curator",
        actorType: "AI_CURATOR",
        actorDisplayName: "ottline curator",
        disclosure: "AI",
        publishedAt: now,
      },
    ]);
  if (url.pathname === "/api/nalytic/events") {
    events.push(data);
    res.writeHead(204).end();
    return;
  }
  const match = url.pathname.match(/^\/api\/discussions\/([^/]+)(?:\/(.*))?$/);
  if (match) {
    const [, id, suffix] = match;
    const story = stories.find((item) => item.id === id);
    if (!suffix) {
      if (gates.has(id)) await gates.get(id).promise;
      const status = statuses.get(id) ?? (story ? 200 : 404);
      return json(
        status === 200 ? story : { message: "Isolated API response" },
        status,
      );
    }
    if (suffix === "comments") {
      const current = comments.get(id) ?? [
        {
          id: `comment-${id}`,
          discussionId: id,
          userId: "another-reader",
          authorName: "A reader",
          body: `Human comment: ${story?.titleName}`,
          createdAt: now,
        },
      ];
      if (req.method === "POST") {
        const created = {
          id: `comment-created-${Date.now()}`,
          discussionId: id,
          userId,
          authorName: "Me",
          body: data.body,
          createdAt: now,
        };
        comments.set(id, [...current, created]);
        return json(created);
      }
      return json(current);
    }
    if (suffix.startsWith("reactions")) {
      const selected = new Set(reactions.get(id) ?? []);
      let added = false;
      if (req.method === "PUT") {
        added = !selected.has(data.type);
        if (added) selected.add(data.type);
        else selected.delete(data.type);
        reactions.set(id, [...selected]);
      }
      return json({
        selected: added,
        selectedTypes: [...selected],
        summary: {
          done: Number(selected.has("DONE")),
          curious: Number(selected.has("CURIOUS")),
          save: Number(selected.has("SAVE")),
        },
      });
    }
  }
  if (url.pathname === "/api/discussions") {
    const item = stories.find(
      (story) => story.titleId === url.searchParams.get("titleId"),
    );
    return json(
      item
        ? { id: item.id, titleId: item.titleId, commentSeq: 1, createdAt: now }
        : null,
    );
  }
  if (url.pathname === "/api/sync/pull")
    return json({ serverTime: now, changes: { titles: [], logs: [] } });
  if (url.pathname === "/api/sync/push")
    return json({
      accepted: (data?.changes?.logs ?? []).map((item) => item.id),
      rejected: [],
    });
  if (url.pathname === "/api/auth/profile")
    return json({ userId, nickname: null, personaKey: null });
  if (url.pathname === "/api/auth/devices") return json([{ id: deviceId }]);
  if (url.pathname === "/api/auth/register")
    return json({ userId, deviceId, pairingCode: "ISOLATED-TOGETHER-QA" });
  if (url.pathname === "/api/logs/page")
    return json({ items: [], nextCursor: null });
  return json([]);
});

async function poll(label, read, accepts = Boolean) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const value = await read();
    if (accepts(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  assert.fail(label);
}

async function contextFor(locale, width = 1440, javaScriptEnabled = true) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    locale: locale === "ko" ? "ko-KR" : "en-US",
    timezoneId: "Asia/Seoul",
    javaScriptEnabled,
    serviceWorkers: "block",
  });
  await context.addInitScript(
    ({ userId, deviceId, titleId }) => {
      localStorage.setItem("watchlog.userId", userId);
      localStorage.setItem("watchlog.deviceId", deviceId);
      localStorage.setItem("watchlog.pairingCode", "ISOLATED-TOGETHER-QA");
      sessionStorage.setItem(
        "watchlog.analytics.curatedAttribution",
        JSON.stringify({
          curatedContentId: "legacy-curator-fixture",
          titleId,
          storedAt: Date.now(),
        }),
      );
    },
    { userId, deviceId, titleId: stories[0].titleId },
  );
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    try {
      const response = await route.fetch({
        url: `${backendOrigin}${url.pathname}${url.search}`,
      });
      await route.fulfill({ response });
    } catch (error) {
      // Route changes intentionally abort pending requests.
      if (!/closed|aborted|canceled|disposed|ECONNRESET/i.test(String(error)))
        throw error;
    } finally {
      completedApiRequests.add(url.pathname);
    }
  });
  return context;
}

function routePath(locale, id = "") {
  return `${locale === "en" ? "/en" : ""}/public${id ? `/${id}` : ""}`;
}
const results = [];
async function check(label, fn) {
  await fn();
  results.push(label);
  console.log(`PASS ${label}`);
}
async function ready(page, id) {
  await page
    .locator(`[data-testid="discussion-detail"][data-discussion-id="${id}"]`)
    .waitFor();
}
async function noOverflow(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "No horizontal page overflow",
  );
}

await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
const backendOrigin = `http://127.0.0.1:${backend.address().port}`;
try {
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, "localhost", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  base = `http://localhost:${port}`;
  const require = createRequire(path.join(buildRoot, "package.json"));
  next = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      "start",
      "--hostname",
      "localhost",
      "--port",
      String(port),
    ],
    {
      cwd: buildRoot,
      env: {
        ...process.env,
        BACKEND_URL: backendOrigin,
        APP_VERSION: "isolated-together-qa",
        TZ: "UTC",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  for (const stream of [next.stdout, next.stderr])
    stream.on("data", (chunk) => {
      nextOutput = `${nextOutput}${chunk}`.slice(-16_000);
    });
  await poll("Production Next server starts", async () => {
    if (next.exitCode !== null) throw new Error(nextOutput);
    return fetch(`${base}/.well-known/ottline-version`)
      .then((response) => response.ok)
      .catch(() => false);
  });
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    headless: true,
    args: ["--no-sandbox"],
  });

  for (const [locale, id] of [
    ["ko", ids[0]],
    ["en", ids[1]],
    ["en", ids[2]],
  ]) {
    await check(
      `SSR ${locale} ${id}: loading, never false missing`,
      async () => {
        const context = await contextFor(locale, 1440, false);
        try {
          const page = await context.newPage();
          const response = await page.goto(`${base}${routePath(locale, id)}`);
          assert.equal(response.status(), 200);
          assert.equal(
            await page
              .getByText(messages[locale].DiscussionDetail.notFound, {
                exact: true,
              })
              .count(),
            0,
          );
          assert.equal(await page.getByTestId("discussion-loading").count(), 1);
          assert.equal(
            await page.locator(`[data-discussion-link="${id}"]`).count(),
            1,
            "Human listing is server rendered",
          );
          assert.equal(
            await page.locator("time").last().textContent(),
            new Date(stories.at(-1).createdAt).toLocaleDateString(
              locale === "ko" ? "ko-KR" : "en-US",
              { month: "short", day: "numeric", timeZone: "UTC" },
            ),
            "Server-rendered public dates use a deterministic zone",
          );
        } finally {
          await context.close();
        }
      },
    );
  }

  for (const locale of ["ko", "en"]) {
    reactions.clear();
    const context = await contextFor(locale);
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    try {
      await check(`${locale}: direct entry and refresh`, async () => {
        for (const id of locale === "ko" ? [ids[0]] : ids.slice(1)) {
          await page.goto(`${base}${routePath(locale, id)}`);
          await ready(page, id);
          await page
            .getByText(
              `Human comment: ${stories.find((item) => item.id === id).titleName}`,
              { exact: true },
            )
            .waitFor();
          await page.reload();
          await ready(page, id);
        }
        await noOverflow(page);
        const localDate = new Date(stories.at(-1).createdAt).toLocaleDateString(
          locale === "ko" ? "ko-KR" : "en-US",
          { month: "short", day: "numeric", timeZone: "Asia/Seoul" },
        );
        await poll(
          "Hydrated public dates retain the reader's local zone",
          () => page.locator("time").last().textContent(),
          (text) => text === localDate,
        );
      });
      await check(
        `${locale}: keyboard navigation, selected URL, two panes`,
        async () => {
          await page.goto(`${base}${routePath(locale)}`);
          const link = page.locator(`[data-discussion-link="${ids[0]}"]`);
          await link.focus();
          await page.keyboard.press("Enter");
          await ready(page, ids[0]);
          assert.equal(new URL(page.url()).pathname, routePath(locale, ids[0]));
          assert.equal(await link.getAttribute("aria-current"), "page");
          const left = await page
            .getByTestId("together-list-pane")
            .boundingBox();
          const right = await page
            .getByTestId("together-detail-pane")
            .boundingBox();
          assert.ok(
            left && right && left.x + left.width <= right.x,
            "List and detail are side by side",
          );
          assert.equal(
            await page.locator(":focus").textContent(),
            stories[0].titleName,
          );
        },
      );
      await check(
        `${locale}: independent scroll survives selection and browser back`,
        async () => {
          const pane = page.getByTestId("together-list-pane");
          await pane.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          const before = await pane.evaluate((element) => element.scrollTop);
          assert.ok(before > 100);
          await page
            .locator(`[data-discussion-link="${stories.at(-1).id}"]`)
            .click();
          await ready(page, stories.at(-1).id);
          assert.ok(
            Math.abs(
              (await pane.evaluate((element) => element.scrollTop)) - before,
            ) < 5,
          );
          await page.goBack();
          await ready(page, ids[0]);
          assert.ok(
            Math.abs(
              (await pane.evaluate((element) => element.scrollTop)) - before,
            ) < 5,
          );
        },
      );
      await check(
        `${locale}: search, sort, selection persist through resize and back`,
        async () => {
          const search = page.locator("#public-title-search");
          await search.fill("Journey");
          await page.locator("#public-sort").selectOption("comments");
          await page
            .locator(`[data-discussion-link="${stories.at(-1).id}"]`)
            .click();
          await ready(page, stories.at(-1).id);
          await page.setViewportSize({ width: 390, height: 844 });
          assert.equal(
            await page.getByTestId("together-list-pane").isVisible(),
            false,
          );
          assert.equal(
            await page.getByTestId("together-detail-pane").isVisible(),
            true,
          );
          await noOverflow(page);
          await page.setViewportSize({ width: 1440, height: 1000 });
          assert.equal(await search.inputValue(), "Journey");
          assert.equal(
            await page.locator("#public-sort").inputValue(),
            "comments",
          );
          await ready(page, stories.at(-1).id);
          await page
            .getByRole("link", {
              name: messages[locale].DiscussionDetail.backToList,
              exact: true,
            })
            .click();
          assert.equal(await search.inputValue(), "Journey");
          assert.equal(
            await page.locator("#public-sort").inputValue(),
            "comments",
          );
          await search.fill("");
          await page.locator("#public-sort").selectOption("latest");
        },
      );
      await check(
        `${locale}: slow response and quick second selection cannot show stale detail`,
        async () => {
          let release;
          completedApiRequests.delete(`/api/discussions/${ids[0]}`);
          gates.set(ids[0], {
            promise: new Promise((resolve) => {
              release = resolve;
            }),
          });
          try {
            await page.locator(`[data-discussion-link="${ids[0]}"]`).click();
            await page.getByTestId("discussion-loading").waitFor();
            assert.equal(
              await page.getByTestId("discussion-missing").count(),
              0,
            );
            await page.locator(`[data-discussion-link="${ids[1]}"]`).click();
            await ready(page, ids[1]);
            release();
            gates.delete(ids[0]);
            await poll("Released A request settles", () =>
              completedApiRequests.has(`/api/discussions/${ids[0]}`),
            );
            await poll(
              "B remains selected",
              () =>
                page
                  .getByTestId("discussion-detail")
                  .getAttribute("data-discussion-id"),
              (id) => id === ids[1],
            );
            assert.equal(
              await page
                .getByText(`Human comment: ${stories[0].titleName}`, {
                  exact: true,
                })
                .count(),
              0,
            );
          } finally {
            release();
            gates.delete(ids[0]);
          }
        },
      );
      await check(
        `${locale}: a delayed detail does not steal focus from search`,
        async () => {
          let release;
          gates.set(ids[0], {
            promise: new Promise((resolve) => {
              release = resolve;
            }),
          });
          try {
            await page.locator(`[data-discussion-link="${ids[0]}"]`).click();
            await page.getByTestId("discussion-loading").waitFor();
            await page.locator("#public-title-search").fill("Dune");
            release();
            await ready(page, ids[0]);
            assert.equal(
              await page.locator(":focus").getAttribute("id"),
              "public-title-search",
            );
            assert.equal(
              await page.locator("#public-title-search").inputValue(),
              "Dune",
            );
            await page.locator("#public-title-search").fill("");
          } finally {
            release();
            gates.delete(ids[0]);
          }
        },
      );
      await check(
        `${locale}: HTTP 404 is missing; 503 offers working retry`,
        async () => {
          await page.locator(`[data-discussion-link="${ids[1]}"]`).click();
          await ready(page, ids[1]);
          statuses.set(ids[0], 404);
          await page.locator(`[data-discussion-link="${ids[0]}"]`).click();
          await page.getByTestId("discussion-missing").waitFor();
          assert.equal(await page.getByTestId("discussion-error").count(), 0);
          statuses.set(ids[2], 503);
          await page.locator(`[data-discussion-link="${ids[2]}"]`).click();
          await page.getByTestId("discussion-error").waitFor();
          assert.equal(await page.getByTestId("discussion-missing").count(), 0);
          statuses.delete(ids[2]);
          await page
            .getByRole("button", {
              name: messages[locale].DiscussionDetail.retry,
              exact: true,
            })
            .click();
          await ready(page, ids[2]);
          statuses.delete(ids[0]);
        },
      );
      await check(
        `${locale}: comments, reactions and queued local record remain functional`,
        async () => {
          await page.locator(`[data-discussion-link="${ids[0]}"]`).click();
          await ready(page, ids[0]);
          const detail = page.getByTestId("discussion-detail");
          await detail
            .getByLabel(messages[locale].CommentsPanel.inputTitleModern, {
              exact: true,
            })
            .fill(`Human contribution ${locale}`);
          await detail
            .getByRole("button", {
              name: messages[locale].CommentsPanel.submitActionModern,
              exact: true,
            })
            .click();
          await detail
            .getByText(`Human contribution ${locale}`, { exact: true })
            .waitFor();
          await page.evaluate(() =>
            Object.defineProperty(navigator, "onLine", {
              configurable: true,
              value: false,
            }),
          );
          const reaction = detail.getByRole("button", {
            name: new RegExp(messages[locale].DiscussionReactions.curiousLabel),
          });
          await reaction.click();
          await detail
            .getByText(messages[locale].DiscussionReactions.savedMessage, {
              exact: false,
            })
            .waitFor();
          const readRecords = () =>
            page.evaluate(
              () =>
                new Promise((resolve, reject) => {
                  const request = indexedDB.open("watchlog");
                  request.onerror = () => reject(request.error);
                  request.onsuccess = () => {
                    const db = request.result,
                      result = {};
                    const tx = db.transaction(["logs", "outbox"], "readonly");
                    for (const table of ["logs", "outbox"]) {
                      const read = tx.objectStore(table).getAll();
                      read.onsuccess = () => {
                        result[table] = read.result;
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
          const local = await poll(
            "Reaction creates a queued local record",
            readRecords,
            (value) => value.logs.length === 1 && value.outbox.length === 1,
          );
          assert.equal(local.logs[0].titleId, stories[0].titleId);
          assert.equal(local.logs[0].status, "WISHLIST");
          assert.equal(await reaction.getAttribute("aria-pressed"), "true");
          await reaction.click();
          await detail
            .getByText(messages[locale].DiscussionReactions.removedMessage, {
              exact: true,
            })
            .waitFor();
          await poll("Reaction toggle settles", () => reaction.isEnabled());
          assert.equal(
            (await readRecords()).logs.length,
            1,
            "Removing a reaction must preserve the user's record",
          );
          assert.equal(
            await detail
              .getByRole("link", {
                name: messages[locale].DiscussionDetail.viewTitleDetail,
                exact: true,
              })
              .getAttribute("href"),
            `${locale === "en" ? "/en" : ""}/title/${stories[0].titleId}`,
          );
          for (const pane of ["together-list-pane", "together-detail-pane"]) {
            await page.getByTestId(pane).evaluate((element) => {
              element.scrollTop = 0;
            });
          }
          await page.screenshot({
            path: path.join(output, `${locale}-desktop.png`),
            fullPage: true,
          });
          await page.setViewportSize({ width: 390, height: 844 });
          await noOverflow(page);
          await page.screenshot({
            path: path.join(output, `${locale}-mobile.png`),
            fullPage: true,
          });
        },
      );
      await check(
        `${locale}: compact list and intermediate widths remain usable`,
        async () => {
          await page
            .getByRole("link", {
              name: messages[locale].DiscussionDetail.backToList,
              exact: true,
            })
            .click();
          await page
            .getByTestId("together-list-pane")
            .waitFor({ state: "visible" });
          for (const width of [320, 768, 895, 896, 1024]) {
            await page.setViewportSize({ width, height: 1000 });
            assert.equal(
              await page.getByTestId("together-list-pane").isVisible(),
              true,
            );
            await noOverflow(page);
          }
          await page.setViewportSize({ width: 390, height: 844 });
          await page
            .locator(`[data-discussion-link="${stories.at(-1).id}"]`)
            .click();
          await ready(page, stories.at(-1).id);
          assert.equal(
            await page.getByTestId("together-list-pane").isVisible(),
            false,
          );
          const heading = await page
            .getByTestId("discussion-detail")
            .getByRole("heading", { level: 2 })
            .boundingBox();
          assert.ok(
            heading && heading.y >= 0 && heading.y < 844,
            "Opening a story from the bottom of a compact list shows its title",
          );
          await noOverflow(page);
        },
      );
      assert.deepEqual(pageErrors, []);
    } finally {
      statuses.clear();
      await context.close();
    }
  }
  await check(
    "Curator queries, surfaces and all three event types stay retired",
    async () => {
      assert.equal(
        requests.filter((item) => item.path.includes("curated-contents"))
          .length,
        0,
      );
      assert.equal(
        events.filter((item) => item?.eventName?.startsWith("curated_")).length,
        0,
      );
      assert.ok(
        events.some((item) => item?.eventName === "log_create"),
        "Human recording analytics are preserved",
      );
    },
  );
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      { results, count: results.length, apiRequests: requests.length },
      null,
      2,
    ),
  );
  console.log(
    `Together runtime: ${results.length} checks passed. Artifacts: ${output}`,
  );
} catch (error) {
  console.error(nextOutput);
  throw error;
} finally {
  for (const gate of gates.values()) gate.release?.();
  await browser?.close();
  if (next && next.exitCode === null) {
    next.kill("SIGTERM");
    await Promise.race([
      once(next, "exit"),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    if (next.exitCode === null) next.kill("SIGKILL");
  }
  backend.closeAllConnections();
  await new Promise((resolve) => backend.close(resolve));
}
