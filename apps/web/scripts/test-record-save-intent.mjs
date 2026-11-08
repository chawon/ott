/** Rendered recording flow + IndexedDB. All API calls are mocked; no user data is written. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3000");
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) ||
    (process.env.RECORD_SAVE_QA_ALLOW_PREVIEW === "1" &&
      base.hostname === "172.24.75.199"),
  "Loopback is required unless the current WSL preview is explicitly enabled",
);
const output =
  process.env.RECORD_SAVE_QA_OUTPUT ?? "/tmp/ottline-record-save-intent";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});

async function readLogs(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("watchlog");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const request = db
            .transaction("logs", "readonly")
            .objectStore("logs")
            .getAll();
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
          request.onerror = () => {
            db.close();
            reject(request.error);
          };
        };
      }),
  );
}

const cases = [
  {
    name: "mobile-ko-movie",
    locale: "ko",
    type: "movie",
    width: 390,
    height: 844,
    keyboard: true,
  },
  {
    name: "desktop-ko-movie",
    locale: "ko",
    type: "movie",
    width: 1440,
    height: 1000,
  },
  {
    name: "mobile-en-book",
    locale: "en",
    type: "book",
    width: 390,
    height: 844,
  },
  {
    name: "desktop-en-series",
    locale: "en",
    type: "series",
    width: 1440,
    height: 1000,
  },
].filter(
  (item) =>
    !process.env.RECORD_SAVE_QA_CASE ||
    item.name === process.env.RECORD_SAVE_QA_CASE,
);

try {
  for (const item of cases) {
    const titleId = "10000000-0000-4000-8000-000000000031";
    const title = {
      id: titleId,
      provider: item.type === "book" ? "KAKAO" : "TMDB",
      providerId: item.type === "book" ? "9788936433598" : "27205",
      type: item.type,
      name: "기록 흐름 검증",
      year: 2010,
      posterUrl: null,
      genres: [],
      isbn13: item.type === "book" ? "9788936433598" : undefined,
    };
    const state = { log: null, pushes: [], errors: [] };
    const context = await browser.newContext({
      viewport: { width: item.width, height: item.height },
      locale: item.locale === "ko" ? "ko-KR" : "en-US",
      timezoneId: "Asia/Seoul",
      serviceWorkers: "block",
    });
    await context.addInitScript(() => {
      localStorage.setItem(
        "watchlog.userId",
        "30000000-0000-4000-8000-000000000031",
      );
      localStorage.setItem(
        "watchlog.deviceId",
        "40000000-0000-4000-8000-000000000031",
      );
      localStorage.setItem("watchlog.pairingCode", "TEST-ONLY-CODE");
    });
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (!url.pathname.startsWith("/api/"))
        return url.origin === base.origin ? route.continue() : route.abort();
      const path = url.pathname.slice(4);
      const reply = (value) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(value),
        });
      if (path === "/titles/search") return reply([title]);
      if (path === "/titles/popular") return reply([]);
      if (path === "/sync/push") {
        const body = request.postDataJSON();
        state.pushes.push(body);
        for (const log of body.changes.logs)
          state.log = {
            ...state.log,
            ...log.payload,
            id: log.id,
            titleId,
            createdAt: log.updatedAt,
            updatedAt: log.updatedAt,
          };
        return reply({
          accepted: body.changes.logs.map((log) => log.id),
          rejected: [],
        });
      }
      if (path === "/sync/pull")
        return reply({
          serverTime: new Date().toISOString(),
          changes: {
            titles: state.log ? [title] : [],
            logs: state.log ? [state.log] : [],
          },
        });
      if (path === "/tmdb/tv/27205/seasons")
        return reply([
          {
            seasonNumber: 2,
            name: "Second season",
            year: 2025,
            posterUrl: null,
          },
        ]);
      if (path === "/tmdb/tv/27205/seasons/2")
        return reply([{ episodeNumber: 3, name: "Third episode" }]);
      if (path.startsWith("/tmdb/"))
        return reply({ genres: [], directors: [], cast: [] });
      if (path === "/discussions/connection") return reply(null);
      if (
        path.startsWith("/discussions") ||
        path === "/logs" ||
        path === "/auth/devices"
      )
        return reply([]);
      if (path.startsWith("/titles/")) return reply(title);
      return reply({});
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => state.errors.push(error.message));
    try {
      await page.goto(`${base.origin}/${item.locale}?quick=1`);
      const dialog = page.getByRole("dialog");
      const input = page.getByTestId("title-search");
      await input.fill(title.name);
      await page.getByTestId("title-search-result").first().waitFor();
      const searchBox = await dialog.boundingBox();
      await page.getByTestId("title-search-result").first().click();
      await page.getByTestId("record-status-DONE").waitFor();
      const selectedBox = await dialog.boundingBox();
      console.log(
        JSON.stringify({
          name: item.name,
          searchBox,
          selectedBox,
          initialPushes: state.pushes.length,
        }),
      );
      await page.screenshot({
        path: join(output, `${item.name}-selected.png`),
      });
      assert.ok(
        Math.abs(selectedBox.height - searchBox.height) <= 2,
        "Choosing a title must preserve the recording dialog height",
      );
      const save = page.getByTestId("record-save-initial");
      assert.equal(
        await save.count(),
        1,
        "A separate final save action must be present after choosing a title",
      );
      assert.equal(
        await save.isDisabled(),
        true,
        "Choose a status explicitly before keeping a record",
      );
      await page.getByTestId("record-status-WISHLIST").click();
      await page.getByTestId("record-status-DONE").click();
      await page.waitForTimeout(150);
      assert.equal(
        state.pushes.length,
        0,
        "Status selection must not push a record",
      );
      assert.deepEqual(
        await readLogs(page),
        [],
        "Status selection must not create a local record",
      );
      assert.equal(
        await page
          .getByTestId("record-status-DONE")
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(await save.isEnabled(), true);
      await page
        .getByText(
          item.locale === "ko" ? "그날의 순간 (선택)" : "The moment (optional)",
          { exact: true },
        )
        .click();
      await page.getByTestId("record-date").fill("2025-06-14");
      if (item.type === "series") {
        await page.getByTestId("record-season").selectOption("2");
        await page.getByTestId("record-episode").selectOption("3");
      }
      if (item.keyboard) {
        await page.evaluate(() => {
          Object.defineProperty(window.visualViewport, "height", {
            configurable: true,
            value: 400,
          });
          Object.defineProperty(window.visualViewport, "offsetTop", {
            configurable: true,
            value: 90,
          });
          window.visualViewport.dispatchEvent(new Event("resize"));
        });
        await page.waitForFunction(
          () =>
            document.querySelector('[role="dialog"]')?.getBoundingClientRect()
              .height <= 401,
        );
      }
      assert.deepEqual(
        await readLogs(page),
        [],
        "Changing statuses and optional context must remain an unsaved draft",
      );
      assert.equal(state.pushes.length, 0);
      const visibleFooter = await save.boundingBox();
      const bounds = await dialog.boundingBox();
      assert.ok(
        visibleFooter.y >= bounds.y &&
          visibleFooter.y + visibleFooter.height <=
            bounds.y + bounds.height + 1,
        "Save stays visible with expanded context and the mobile keyboard",
      );
      await page.screenshot({ path: join(output, `${item.name}-ready.png`) });
      await save.click();
      await page.getByTestId("record-done").waitFor();
      await page.waitForFunction(
        () =>
          document
            .querySelector('[role="dialog"]')
            ?.getAttribute("data-record-stage") === "saved",
      );
      const logs = await readLogs(page);
      assert.equal(logs.length, 1);
      assert.equal(logs[0].status, "DONE");
      assert.equal(
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
          new Date(logs[0].watchedAt),
        ),
        "2025-06-14",
      );
      if (item.type === "series") {
        assert.equal(logs[0].seasonNumber, 2);
        assert.equal(logs[0].episodeNumber, 3);
        assert.equal(logs[0].seasonYear, 2025);
      }
      assert.equal(
        state.pushes.length,
        1,
        "One explicit save pushes exactly one record",
      );
      assert.deepEqual(state.errors, []);
      console.log(
        JSON.stringify({
          name: item.name,
          result: "PASS",
          records: logs.length,
          pushes: state.pushes.length,
          visibleFooter,
        }),
      );
    } catch (error) {
      await page.screenshot({ path: join(output, `${item.name}-failure.png`) });
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
