import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const baseUrl = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3000");
assert.ok(
  baseUrl.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(baseUrl.hostname),
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});

async function snapshot(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("watchlog");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = (store) =>
      new Promise((resolve, reject) => {
        const request = db.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const result = {
      logs: await read("logs"),
      titles: await read("titles"),
      outbox: await read("outbox"),
    };
    db.close();
    return result;
  });
}

async function waitForSnapshot(page, predicate) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const state = await snapshot(page);
    if (predicate(state)) return state;
    await delay(100);
  }
  throw new Error("Timed out waiting for local book state");
}

try {
  for (const scenario of [
    "new-google-edition",
    "existing-kakao-edition",
    "without-isbn",
  ]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    try {
      await context.addInitScript(() => {
        localStorage.setItem(
          "watchlog.userId",
          "11111111-1111-4111-8111-111111111111",
        );
        localStorage.setItem(
          "watchlog.deviceId",
          "22222222-2222-4222-8222-222222222222",
        );
        localStorage.setItem("watchlog.pairingCode", "BOOKTEST");
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const isbn = scenario === "without-isbn" ? null : "9780735211292";
      const selected = {
        provider: "GOOGLE_BOOKS",
        providerId: `volume-${scenario}`,
        type: "book",
        name: "Atomic Habits",
        author: "James Clear",
        publisher: "Avery",
        year: 2018,
        isbn13: isbn,
        pubdate: "20181016",
        sourceUrl: `https://books.google.com/books?id=volume-${scenario}`,
      };
      const canonicalId = "33333333-3333-4333-8333-333333333333";
      let serverTitle = null;
      const serverLogs = new Map();
      let pushMode = "fail";
      let failedPushes = 0;
      let searchLocale = null;
      await page.route("**/api/**", async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (path === "/api/titles/search") {
          assert.equal(new URL(request.url()).searchParams.get("type"), "book");
          searchLocale = request.headers()["accept-language"];
          return route.fulfill({ json: [selected] });
        }
        if (path === "/api/sync/push") {
          if (pushMode === "fail") {
            failedPushes += 1;
            return route.abort();
          }
          const { changes } = request.postDataJSON();
          const updatedAt = new Date().toISOString();
          for (const change of changes.titles ?? []) {
            serverTitle = { ...change.payload, id: canonicalId, updatedAt };
          }
          for (const change of changes.logs ?? []) {
            const previous = serverLogs.get(change.id);
            serverLogs.set(change.id, {
              ...previous,
              ...change.payload,
              id: change.id,
              titleId: canonicalId,
              watchedAt:
                change.payload.watchedAt ?? previous?.watchedAt ?? updatedAt,
              createdAt: previous?.createdAt ?? updatedAt,
              updatedAt,
            });
          }
          return route.fulfill({
            json: {
              accepted: [
                ...(changes.titles ?? []),
                ...(changes.logs ?? []),
              ].map((c) => c.id),
              rejected: [],
            },
          });
        }
        if (path === "/api/sync/pull") {
          return route.fulfill({
            json: {
              serverTime: new Date().toISOString(),
              changes: {
                titles: serverTitle ? [serverTitle] : [],
                logs: [...serverLogs.values()],
              },
            },
          });
        }
        if (path === "/api/logs/page" || path === "/api/logs") {
          const items = [...serverLogs.values()].map((log) => ({
            ...log,
            title: serverTitle,
          }));
          return route.fulfill({
            json: path.endsWith("/page") ? { items, nextCursor: null } : items,
          });
        }
        if (path.startsWith("/api/titles/"))
          return route.fulfill({ json: serverTitle ?? {} });
        if (path === "/api/auth/profile")
          return route.fulfill({ json: { nickname: null, personaKey: null } });
        if (
          path.includes("discussions") ||
          path.includes("popular") ||
          path.includes("history")
        )
          return route.fulfill({ json: [] });
        return route.fulfill({ json: {} });
      });

      await page.goto(new URL("/en/?quick=1", baseUrl).href);
      await page
        .locator('[data-onboarding-target="content-type"]')
        .getByRole("button", { name: "Book", exact: true })
        .click();
      const existingId = "44444444-4444-4444-8444-444444444444";
      if (scenario === "existing-kakao-edition") {
        await snapshot(page); // Ensure the application has opened the current schema.
        await page.evaluate(
          async ({ existingId, isbn }) => {
            const db = await new Promise((resolve) => {
              const request = indexedDB.open("watchlog");
              request.onsuccess = () => resolve(request.result);
            });
            await new Promise((resolve, reject) => {
              const tx = db.transaction("titles", "readwrite");
              tx.objectStore("titles").put({
                id: existingId,
                type: "book",
                name: "Existing edition",
                provider: "KAKAO",
                providerId: isbn,
                isbn13: isbn,
              });
              tx.oncomplete = resolve;
              tx.onerror = () => reject(tx.error);
            });
            db.close();
          },
          { existingId, isbn },
        );
      }
      await page
        .locator('[data-onboarding-target="title-search"] input')
        .fill("Atomic Habits");
      const result = page.getByRole("button", { name: /Atomic Habits/ });
      await result.waitFor();
      assert.equal(searchLocale, "en");
      assert.ok(await page.locator('img[alt="Powered by Google"]').isVisible());
      assert.equal(
        await page.locator(`a[href="${selected.sourceUrl}"]`).count(),
        1,
      );
      await result.click();
      await context.setOffline(true);
      await page.getByRole("button", { name: "Read", exact: true }).click();
      await page
        .getByText("Kept. Anything else to remember?", { exact: true })
        .waitFor();
      await page
        .getByPlaceholder("Keep a scene, line, or feeling you may want later.")
        .fill("My own book note");
      await page.locator('select:has(option[value="5"])').selectOption("5");
      const platforms = page.locator('select:has(option[value="Kindle"])');
      const choices = await platforms
        .locator("optgroup option")
        .allTextContents();
      for (const value of [
        "Kindle",
        "Apple Books",
        "Google Play Books",
        "Kobo",
        "Audible",
        "Libby",
      ])
        assert.ok(choices.includes(value));
      for (const value of ["Kyobo", "Ridi", "Millie", "TVING"])
        assert.ok(!choices.includes(value));
      await platforms.selectOption("Kindle");
      await page
        .getByRole("button", { name: "Keep This Log", exact: true })
        .click();
      const offline = await waitForSnapshot(
        page,
        (state) =>
          state.logs[0]?.note === "My own book note" &&
          state.outbox.length >= 2,
      );
      assert.equal(offline.logs.length, 1);
      assert.equal(offline.titles.length, 1);
      if (scenario === "existing-kakao-edition")
        assert.equal(offline.logs[0].titleId, existingId);
      assert.equal(offline.logs[0].title.provider, "GOOGLE_BOOKS");
      assert.equal(offline.logs[0].title.providerId, selected.providerId);
      assert.equal(offline.logs[0].title.isbn13 ?? null, isbn);
      assert.equal(offline.logs[0].rating, 5);
      assert.equal(offline.logs[0].ott, "Kindle");

      await context.setOffline(false);
      await waitForSnapshot(page, (state) =>
        state.outbox.some((item) => item.attempts > 0),
      );
      assert.ok(failedPushes > 0);
      assert.equal((await snapshot(page)).logs[0].note, "My own book note");
      pushMode = "ok";
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      const synced = await waitForSnapshot(
        page,
        (state) =>
          state.outbox.length === 0 && state.logs[0]?.titleId === canonicalId,
      );
      assert.equal(synced.titles.length, 1);
      assert.equal(synced.logs[0].title.provider, "GOOGLE_BOOKS");
      assert.equal(synced.logs[0].title.providerId, selected.providerId);
      for (const field of ["note", "rating", "status", "watchedAt", "ott"])
        assert.equal(synced.logs[0][field], offline.logs[0][field]);
      await page.goto(new URL("/en/timeline", baseUrl).href);
      await page.getByRole("link", { name: /^Atomic Habits/ }).waitFor();
      assert.equal((await snapshot(page)).logs[0].titleId, canonicalId);
      if (scenario === "existing-kakao-edition") {
        const logId = synced.logs[0].id;
        const legacyPlatform = "밀리의서재";
        serverLogs.set(logId, {
          ...serverLogs.get(logId),
          ott: legacyPlatform,
          updatedAt: new Date().toISOString(),
        });
        // Pull the legacy fixture before opening the editor so its local-first
        // cache and server response describe the same existing record.
        await page.evaluate(() => window.dispatchEvent(new Event("online")));
        await waitForSnapshot(
          page,
          (state) =>
            state.logs[0]?.ott === legacyPlatform && state.outbox.length === 0,
        );
        await page.goto(new URL(`/en/title/${canonicalId}`, baseUrl).href);
        await page.locator('select:has(option[value="Kindle"])').waitFor();
        const legacyInput = page.locator(`input[value="${legacyPlatform}"]`);
        await legacyInput.waitFor();
        assert.equal(await legacyInput.inputValue(), legacyPlatform);
        await page
          .getByRole("textbox", { name: "Note", exact: true })
          .fill("Legacy platform preserved");
        await page.getByRole("button", { name: "Update", exact: true }).click();
        const updated = await waitForSnapshot(
          page,
          (state) =>
            state.logs[0]?.note === "Legacy platform preserved" &&
            state.outbox.length === 0,
        );
        assert.equal(updated.logs[0].ott, legacyPlatform);
        assert.equal(updated.logs[0].rating, 5);
        assert.equal(updated.logs[0].watchedAt, synced.logs[0].watchedAt);
        console.log(
          "PASS legacy platform: existing Korean value survives English detail editing",
        );
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${scenario}: English search, Google attribution, offline create/update, failed push, retry, canonical pull and timeline`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
