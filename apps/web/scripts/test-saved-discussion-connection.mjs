/** Rendered recording + actual IndexedDB; every API call is intercepted. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3218");
assert.ok(
  ["127.0.0.1", "localhost"].includes(base.hostname) ||
    (process.env.SAVED_DISCUSSION_QA_ALLOW_PREVIEW === "1" &&
      base.hostname === "172.24.75.199"),
  "Loopback is required unless the current WSL preview is explicitly enabled",
);
const output =
  process.env.SAVED_DISCUSSION_QA_OUTPUT ??
  join(tmpdir(), "ottline-saved-discussion-connection");
await mkdir(output, { recursive: true });
const titleId = "10000000-0000-4000-8000-000000000081";
const logId = "20000000-0000-4000-8000-000000000081";
const discussionId = "50000000-0000-4000-8000-000000000081";
const userId = "30000000-0000-4000-8000-000000000081";
const deviceId = "40000000-0000-4000-8000-000000000081";
const secondUser = "30000000-0000-4000-8000-000000000082";
const spoiler =
  "SPOILER: a public thought must not appear before opening the conversation.";
const now = "2026-11-08T08:00:00.000Z";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});

async function poll(label, read, accept) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const result = await read();
    if (accept(result)) return result;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  assert.fail(label);
}

async function localState(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("watchlog");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const result = { userId: localStorage.getItem("watchlog.userId") };
          const tx = db.transaction(["logs", "history", "outbox"], "readonly");
          for (const key of ["logs", "history", "outbox"]) {
            const get = tx.objectStore(key).getAll();
            get.onsuccess = () => {
              result[key] = get.result;
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

const cases = [
  { name: "other-ko-desktop", locale: "ko", width: 1440 },
  { name: "other-en-mobile", locale: "en", width: 390, status: "WISHLIST" },
  { name: "empty", hasConversation: false },
  { name: "failed", responseStatus: 503 },
  { name: "unauthorized", responseStatus: 401 },
  { name: "forbidden", responseStatus: 403 },
  { name: "offline-resume", offline: true },
  { name: "slow-canonical", slowPull: true },
  { name: "late-close", delayedLookup: true },
  { name: "account-change", delayedLookup: true },
  { name: "identity-type" },
  { name: "identity-edition", book: true },
  { name: "sync-update", hasConversation: false },
  { name: "wrong-destination", wrongDestination: true },
].filter(
  (item) =>
    !process.env.SAVED_DISCUSSION_QA_CASE ||
    item.name === process.env.SAVED_DISCUSSION_QA_CASE,
);
assert.ok(cases.length, "Unknown SAVED_DISCUSSION_QA_CASE");
const results = [];

try {
  for (const item of cases) {
    const locale = item.locale ?? "ko";
    const context = await browser.newContext({
      viewport: {
        width: item.width ?? 390,
        height: (item.width ?? 390) === 390 ? 844 : 1000,
      },
      locale: locale === "ko" ? "ko-KR" : "en-US",
      timezoneId: "Asia/Seoul",
      serviceWorkers: "block",
    });
    const original = {
      provider: item.book ? "KAKAO" : "TMDB",
      providerId: item.book ? "9788983921987" : "27205",
      type: item.book ? "book" : "movie",
      name: `Connection verification ${item.name}`,
      year: 2010,
      posterUrl: process.env.SAVED_DISCUSSION_QA_POSTER
        ? `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="88" height="132"><rect width="88" height="132" fill="#ECEBE9"/></svg>').toString("base64")}`
        : null,
      ...(item.book ? { isbn13: "9788983921987", isbn10: "8983921986" } : {}),
    };
    const canonical = { ...original, id: titleId, updatedAt: now };
    const connectionRequests = [],
      writes = [],
      errors = [];
    let serverLog = null,
      hasConversation = item.hasConversation !== false;
    let releaseLookup, releasePull;
    const lookupGate = new Promise((resolve) => {
      releaseLookup = resolve;
    });
    const pullGate = new Promise((resolve) => {
      releasePull = resolve;
    });
    let heldLookup = false,
      heldPull = false;
    await context.addInitScript(
      ({ userId, deviceId }) => {
        localStorage.setItem("watchlog.userId", userId);
        localStorage.setItem("watchlog.deviceId", deviceId);
        localStorage.setItem("watchlog.pairingCode", "ISOLATED-CONNECTION-QA");
      },
      { userId, deviceId },
    );
    await context.route("**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (!url.pathname.startsWith("/api/"))
        return url.origin === base.origin ? route.continue() : route.abort();
      const path = url.pathname.slice(4);
      const json = (body, status = 200) =>
        route.fulfill({ status, json: body });
      if (request.method() !== "GET") writes.push(path);
      if (path === "/titles/search")
        return json(
          (url.searchParams.get("type") === "book") === !!item.book
            ? [original]
            : [],
        );
      if (path === "/titles/popular") return json([]);
      if (path === "/sync/push") {
        const body = request.postDataJSON();
        for (const change of body.changes.logs)
          serverLog = {
            ...change.payload,
            id: logId,
            titleId,
            createdAt: now,
            updatedAt: change.updatedAt,
          };
        return json({
          accepted: body.changes.logs.map((entry) => entry.id),
          rejected: [],
        });
      }
      if (path === "/sync/pull") {
        if (serverLog && item.slowPull && !heldPull) {
          heldPull = true;
          await pullGate;
        }
        return json({
          serverTime: now,
          changes: {
            titles: serverLog ? [canonical] : [],
            logs: serverLog ? [serverLog] : [],
          },
        });
      }
      if (path === "/discussions/connection") {
        const capturedUser = request.headers()["x-user-id"];
        connectionRequests.push({
          titleId: url.searchParams.get("titleId"),
          userId: capturedUser,
          language: request.headers()["accept-language"],
        });
        assert.equal(request.method(), "GET");
        if (item.delayedLookup && !heldLookup) {
          heldLookup = true;
          await lookupGate;
        }
        if (item.responseStatus)
          return json({ message: "Lookup unavailable" }, item.responseStatus);
        const positive = hasConversation && capturedUser !== secondUser;
        try {
          return await json(
            positive
              ? {
                  discussionId,
                  titleId: item.wrongDestination
                    ? "10000000-0000-4000-8000-000000000099"
                    : titleId,
                }
              : null,
          );
        } catch {
          return;
        } // Unmount/account change correctly aborts this intercepted request.
      }
      if (path === "/auth/profile")
        return json({ userId, nickname: null, personaKey: null });
      if (path === "/auth/devices")
        return json([{ id: deviceId }, { id: "another-qa-device" }]);
      if (path === "/logs")
        return json(serverLog ? [{ ...serverLog, title: canonical }] : []);
      if (path === "/logs/page")
        return json({
          items: serverLog ? [{ ...serverLog, title: canonical }] : [],
          nextCursor: null,
        });
      if (path === `/discussions/${discussionId}`)
        return json({
          id: discussionId,
          titleId,
          titleName: original.name,
          titleType: original.type,
          titleYear: 2010,
          commentCount: 1,
          createdAt: now,
          reactionSummary: { done: 0, curious: 0, save: 0 },
        });
      if (path === "/discussions" && request.method() === "GET")
        return json({
          id: discussionId,
          titleId,
          commentSeq: 1,
          createdAt: now,
        });
      if (path === `/discussions/${discussionId}/comments`)
        return json([
          {
            id: "comment-qa",
            discussionId,
            userId: secondUser,
            authorName: "Another reader",
            body: spoiler,
            createdAt: now,
          },
        ]);
      if (path === `/discussions/${discussionId}/reactions/me`)
        return json({
          summary: { done: 0, curious: 0, save: 0 },
          selectedTypes: [],
        });
      if (path.startsWith("/discussions") || path === "/curated-contents")
        return json([]);
      if (path.startsWith("/titles/")) return json(canonical);
      if (path.startsWith("/tmdb/"))
        return json({
          genres: ["Drama"],
          directors: [],
          cast: [],
          seasons: [],
        });
      if (request.method() !== "GET") return route.fulfill({ status: 204 });
      return json({});
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    const link = page.getByTestId("saved-discussion-link");
    try {
      await page.goto(`${base.origin}/${locale}?quick=1`, {
        waitUntil: "domcontentloaded",
      });
      if (item.book)
        await page
          .getByRole("dialog")
          .getByRole("button", {
            name: locale === "ko" ? "책" : "Book",
            exact: true,
          })
          .click();
      await page.getByTestId("title-search").fill(original.name);
      await page.getByTestId("title-search-result").first().click();
      if (item.offline)
        await page.evaluate(() =>
          Object.defineProperty(navigator, "onLine", {
            configurable: true,
            value: false,
          }),
        );
      await page.getByTestId(`record-status-${item.status ?? "DONE"}`).click();
      await page.getByTestId("record-save-initial").click();
      await page.getByTestId("record-done").waitFor();
      assert.equal(await page.getByText(spoiler, { exact: true }).count(), 0);

      if (item.offline) {
        const local = await poll(
          "offline local record remains queued",
          () => localState(page),
          (state) => state.logs.length === 1 && state.outbox.length === 1,
        );
        assert.equal(local.logs[0].syncStatus, "pending");
        assert.equal(connectionRequests.length, 0);
        assert.equal(await link.count(), 0);
        await page.evaluate(() => {
          delete navigator.onLine;
          window.dispatchEvent(new Event("online"));
        });
      }
      if (item.slowPull) {
        await poll("canonical pull is pending", () => heldPull, Boolean);
        assert.equal(await link.count(), 0);
        assert.equal(
          connectionRequests.length,
          0,
          "A temporary synced ID must not be queried before canonical pull",
        );
        releasePull();
      }
      if (item.name === "late-close" || item.name === "account-change") {
        await poll("lookup is pending", () => heldLookup, Boolean);
        if (item.name === "late-close") {
          await page.getByTestId("record-done").click();
          await poll(
            "recording dialog closed",
            () => page.getByRole("dialog").count(),
            (count) => count === 0,
          );
          releaseLookup();
          await page
            .getByRole("button", {
              name: locale === "ko" ? "기록 남기기" : "Keep a record",
              exact: true,
            })
            .first()
            .click();
          await page.getByTestId("title-search").waitFor();
          assert.equal(await link.count(), 0);
        } else {
          await page.evaluate((id) => {
            localStorage.setItem("watchlog.userId", id);
            window.dispatchEvent(new Event("auth:changed"));
          }, secondUser);
          await poll(
            "new account gets a separate lookup",
            () =>
              connectionRequests.some(
                (request) => request.userId === secondUser,
              ),
            Boolean,
          );
          releaseLookup();
          await page.waitForTimeout(150);
          assert.equal(
            await link.count(),
            0,
            "An old account response must not appear",
          );
          await page.getByTestId("record-done").click();
        }
      } else if (
        !hasConversation ||
        item.responseStatus ||
        item.wrongDestination
      ) {
        await poll(
          "connection lookup completed",
          () => connectionRequests.length,
          (count) => count > 0,
        );
        await page.waitForTimeout(150);
        assert.equal(await link.count(), 0);
        if (item.name === "sync-update") {
          hasConversation = true;
          await page.evaluate(() =>
            window.dispatchEvent(new Event("sync:updated")),
          );
          await link.waitFor();
          await page.getByTestId("record-edit-details").click();
          await page.getByTestId("record-note").waitFor();
          assert.equal(
            await link.count(),
            0,
            "Editing keeps its normal flow and hides the saved-only bridge",
          );
        } else await page.getByTestId("record-done").click();
      } else {
        await link.waitFor();
        assert.equal(
          new URL(await link.getAttribute("href"), base).pathname.replace(
            /^\/(ko|en)(?=\/)/,
            "",
          ),
          `/public/${discussionId}`,
        );
        assert.equal(
          await link.innerText(),
          locale === "ko" ? "함께 이야기 읽기" : "Read the conversation",
        );
        assert.ok(await page.getByTestId("record-edit-details").isVisible());
        assert.ok(await page.getByTestId("record-done").isVisible());
        if (item.name.startsWith("other-")) {
          await page
            .getByRole("dialog")
            .screenshot({ path: join(output, `${item.name}.png`) });
          const bounds = await page.getByRole("dialog").evaluate((dialog) => {
            const rect = (element) => {
              const r = element.getBoundingClientRect();
              return {
                top: r.top,
                bottom: r.bottom,
                left: r.left,
                right: r.right,
              };
            };
            return {
              body: rect(dialog.querySelector('[class*="dialogBody"]')),
              link: rect(
                dialog.querySelector('[data-testid="saved-discussion-link"]'),
              ),
              done: rect(dialog.querySelector('[data-testid="record-done"]')),
              height: innerHeight,
            };
          });
          await writeFile(
            join(output, `${item.name}-bounds.json`),
            JSON.stringify(bounds, null, 2),
          );
          for (const key of ["link", "done"]) {
            assert.ok(
              bounds[key].top >= bounds.body.top - 1 &&
                bounds[key].bottom <=
                  Math.min(bounds.body.bottom, bounds.height) + 1,
              `${key} must be inside the visible dialog body without scrolling`,
            );
          }
        }
        if (item.name.startsWith("identity-")) {
          const before = connectionRequests.length;
          await page.evaluate(
            ({ logId, book }) =>
              new Promise((resolve, reject) => {
                const request = indexedDB.open("watchlog");
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                  const db = request.result,
                    tx = db.transaction("logs", "readwrite");
                  const get = tx.objectStore("logs").get(logId);
                  get.onsuccess = () => {
                    const value = get.result;
                    value.title = book
                      ? {
                          ...value.title,
                          providerId: "9788983927620",
                          isbn13: "9788983927620",
                          isbn10: null,
                        }
                      : { ...value.title, type: "series" };
                    tx.objectStore("logs").put(value);
                  };
                  tx.oncomplete = () => {
                    db.close();
                    window.dispatchEvent(new Event("sync:updated"));
                    resolve();
                  };
                  tx.onerror = () => reject(tx.error);
                };
              }),
            { logId, book: !!item.book },
          );
          await poll(
            "wrong work or edition is hidden",
            () => link.count(),
            (count) => count === 0,
          );
          assert.equal(
            connectionRequests.length,
            before,
            "Identity mismatch cannot query another work's conversation",
          );
          await page.getByTestId("record-done").click();
        } else {
          if (item.name.startsWith("other-"))
            await page
              .getByRole("dialog")
              .screenshot({ path: join(output, `${item.name}.png`) });
          await link.click();
          await page.waitForURL((url) =>
            url.pathname.endsWith(`/public/${discussionId}`),
          );
          assert.equal(await page.locator("html").getAttribute("lang"), locale);
          await page.getByText(spoiler, { exact: true }).waitFor();
          assert.equal(await page.getByRole("dialog").count(), 0);
        }
      }

      const local = await localState(page);
      assert.equal(
        local.logs.length,
        1,
        `${item.name}: lookup cannot clear or duplicate the kept record`,
      );
      assert.equal(local.logs[0].id, logId);
      assert.equal(local.logs[0].status, item.status ?? "DONE");
      assert.equal(local.history.length, 0);
      assert.equal(local.outbox.length, 0);
      assert.equal(
        local.userId,
        item.name === "account-change" ? secondUser : userId,
      );
      assert.ok(
        connectionRequests.every((request) => request.titleId === titleId),
        "Only canonical title IDs are looked up",
      );
      assert.ok(
        connectionRequests.every((request) => request.language === locale),
      );
      assert.equal(
        writes.filter(
          (path) =>
            path.startsWith("/discussions") || path.startsWith("/auth/"),
        ).length,
        0,
        "Looking at a conversation must not publish or register",
      );
      assert.deepEqual(errors, []);
      const result = {
        name: item.name,
        lookups: connectionRequests.length,
        recordCount: local.logs.length,
        publicWrites: 0,
      };
      results.push(result);
      console.log(`PASS ${item.name}`);
    } catch (error) {
      await writeFile(
        join(output, `${item.name}-failure.json`),
        JSON.stringify(
          {
            error: String(error),
            connectionRequests,
            writes,
            errors,
            body: (await page.locator("body").innerText()).slice(0, 4000),
          },
          null,
          2,
        ),
      );
      throw error;
    } finally {
      releaseLookup();
      releasePull();
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
