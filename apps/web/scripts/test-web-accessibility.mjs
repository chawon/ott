/** Browser regression checks with isolated local records and API responses. */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3000");
assert.ok(
  base.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname),
  "Accessibility checks require an isolated loopback server",
);
const titles = [
  {
    id: "audit-title-1",
    provider: "TMDB",
    providerId: "audit-1",
    type: "movie",
    name: "First audit film",
    year: 2026,
    genres: [],
  },
  {
    id: "audit-title-2",
    provider: "TMDB",
    providerId: "audit-2",
    type: "movie",
    name: "Second audit film",
    year: 2026,
    genres: [],
  },
];
const books = [1, 2].map((rank) => ({
  id: `audit-book-${rank}`,
  provider: "GOOGLE_BOOKS",
  providerId: `audit-volume-${rank}`,
  type: "book",
  name: "Shared audit book",
  author: "Audit author",
  publisher: `Edition ${rank}`,
  year: 2026,
  sourceUrl: `https://books.google.com/books?id=audit-volume-${rank}`,
}));
const recordDate = "2026-11-10T12:00:00Z";
const log = {
  id: "audit-record",
  titleId: titles[0].id,
  title: titles[0],
  status: "DONE",
  origin: "LOG",
  watchedAt: recordDate,
  createdAt: recordDate,
  updatedAt: recordDate,
  spoiler: false,
  place: "HOME",
  occasion: "ALONE",
  syncStatus: "synced",
};
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
const passed = [];

async function newContext(locale, width, serviceWorkers = "block") {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    locale: locale === "ko" ? "ko-KR" : "en-US",
    timezoneId: "Asia/Seoul",
    serviceWorkers,
    colorScheme: "light",
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
      localStorage.setItem("watchlog.pairingCode", "ISOLATED-A11Y-QA");
      localStorage.setItem("watchlog.lastSyncAt", new Date().toISOString());
      localStorage.setItem("theme-mode", "light");
    } catch {}
  });
  // Routing also disables the HTTP cache: offline checks cannot pass using a warm HTTP cache.
  await context.route("**/*", (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== base.origin) return route.abort();
    if (url.pathname === "/og/share-card")
      return route.fulfill({ contentType: "image/png", body: pixel });
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (request.method() !== "GET") return route.fulfill({ status: 204 });
    let body = [];
    if (
      url.pathname === "/api/titles/search" &&
      url.searchParams.get("type") !== "book"
    )
      body = titles;
    if (
      url.pathname === "/api/titles/search" &&
      url.searchParams.get("type") === "book" &&
      url.searchParams.get("q") === books[0].name
    )
      body = books;
    if (/^\/api\/titles\/audit-title-[12]$/.test(url.pathname))
      body = titles.find((title) => url.pathname.endsWith(title.id));
    if (url.pathname === "/api/auth/profile")
      body = { nickname: null, personaKey: "cinema_keeper" };
    if (url.pathname === "/api/sync/pull")
      body = {
        serverTime: new Date().toISOString(),
        changes: { logs: [], titles: [] },
      };
    if (url.pathname === "/api/logs/page")
      body = { items: [], nextCursor: null };
    return route.fulfill({ json: body });
  });
  return context;
}

async function seedRecord(page) {
  await page.evaluate(
    (item) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("watchlog");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction(["titles", "logs"], "readwrite");
          tx.objectStore("titles").put(item.title);
          tx.objectStore("logs").put(item);
          tx.oncomplete = () => {
            db.close();
            window.dispatchEvent(new CustomEvent("sync:updated"));
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    log,
  );
  await page.getByTestId("home-featured").waitFor();
}

async function openHome(page, locale) {
  await page.goto(new URL(locale === "ko" ? "/" : "/en", base).href, {
    waitUntil: "networkidle",
  });
  await page.getByTestId("home-first-record").waitFor();
}

async function activeId(page) {
  return page.evaluate(() => document.activeElement?.id);
}

function contrast(first, second) {
  const luminance = (color) => {
    const channels = color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((value) => {
        const normalized = value / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

try {
  for (const locale of ["ko", "en"]) {
    for (const width of [390, 1280]) {
      const context = await newContext(locale, width);
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        await openHome(page, locale);
        await page.keyboard.press("Tab");
        const skip = page.locator('a[href="#main-content"]');
        assert.equal(
          await skip.evaluate((el) => el === document.activeElement),
          true,
        );
        assert.equal(await skip.isVisible(), true);
        await page.keyboard.press("Enter");
        assert.equal(await activeId(page), "main-content");
        await seedRecord(page);

        const opener = page.getByTestId("home-record");
        const themeToggle = page.getByRole("button", {
          name: /^(테마 변경:|Change theme:)/,
        });
        for (const theme of ["light", "dark"]) {
          if (theme === "dark") await themeToggle.click();
          await page.waitForFunction(
            (mode) => document.documentElement.dataset.theme === mode,
            theme,
          );
          await page.keyboard.press("Tab");
          await opener.focus();
          assert.equal(
            await opener.evaluate((el) => el.matches(":focus-visible")),
            true,
          );
          const indicator = await opener.evaluate((el) => ({
            color: getComputedStyle(el).outlineColor,
            width: getComputedStyle(el).outlineWidth,
            background: getComputedStyle(document.body).backgroundColor,
          }));
          assert.ok(Number.parseFloat(indicator.width) >= 2);
          assert.ok(
            contrast(indicator.color, indicator.background) >= 3,
            `${theme} focus indicator contrast must reach 3:1: ${JSON.stringify(indicator)}`,
          );
        }
        await themeToggle.click();
        await page.waitForFunction(
          () => document.documentElement.dataset.theme === "light",
        );
        await opener.click();
        const dialog = page.getByRole("dialog"),
          search = page.getByTestId("title-search");
        await search.fill("audit");
        const candidates = page.getByTestId("title-search-result");
        await candidates.nth(1).waitFor();
        assert.equal(await search.getAttribute("role"), "combobox");
        assert.equal(await search.getAttribute("aria-expanded"), "true");
        const listId = await search.getAttribute("aria-controls");
        assert.ok(listId);
        assert.equal(
          await page.getByRole("listbox").getAttribute("id"),
          listId,
        );
        await search.press("ArrowDown");
        const chosenId = await search.getAttribute("aria-activedescendant");
        assert.equal(chosenId, await candidates.nth(1).getAttribute("id"));
        assert.equal(
          await candidates.nth(1).getAttribute("aria-selected"),
          "true",
        );
        assert.equal(
          await search.evaluate((el) => el === document.activeElement),
          true,
        );
        assert.match(await dialog.ariaSnapshot(), /Second audit film/);
        await search.press("Escape");
        assert.equal(await search.getAttribute("aria-expanded"), "false");
        assert.equal(
          await dialog.count(),
          1,
          "First Escape closes only the suggestions",
        );
        await search.press("ArrowDown");
        await candidates.nth(1).waitFor();
        await search.press("ArrowDown");

        await search.dispatchEvent("compositionstart");
        await search.dispatchEvent("keydown", {
          key: "Enter",
          code: "Enter",
          isComposing: true,
          keyCode: 229,
        });
        assert.equal(
          await candidates.count(),
          2,
          "IME confirmation must not select a result",
        );
        await search.dispatchEvent("compositionend");
        await search.press("Enter");
        await dialog
          .getByText(titles[1].name, { exact: true })
          .first()
          .waitFor();
        assert.equal(await candidates.count(), 0);
        for (let i = 0; i < 15; i++) {
          await page.keyboard.press("Tab");
          assert.equal(
            await dialog.evaluate((el) => el.contains(document.activeElement)),
            true,
          );
        }
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        assert.equal(
          await opener.evaluate((el) => el === document.activeElement),
          true,
        );

        await opener.click();
        await search.fill("audit");
        await candidates.first().click();
        await dialog
          .getByText(titles[0].name, { exact: true })
          .first()
          .waitFor();
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });

        await opener.click();
        await dialog
          .getByRole("button", {
            name: locale === "ko" ? "책" : "Book",
            exact: true,
          })
          .click();
        await search.fill(books[0].name);
        await candidates.nth(1).waitFor();
        const attributionNames = [];
        for (const book of books) {
          const link = dialog.locator(`a[href="${book.sourceUrl}"]`);
          assert.equal(await link.count(), 1);
          const name = await link.getAttribute("aria-label");
          assert.ok(name?.includes(book.name) && name.includes("Google Books"));
          attributionNames.push(name);
        }
        assert.equal(
          new Set(attributionNames).size,
          books.length,
          "Same-title editions need distinct attribution names",
        );
        await dialog
          .getByRole("status")
          .filter({ hasText: locale === "ko" ? /작품 2개/ : /2 titles found/ })
          .waitFor();
        await search.press("Escape");
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });

        for (const reducedMotion of ["no-preference", "reduce"]) {
          await page.emulateMedia({ reducedMotion });
          await page
            .getByTestId("home-featured")
            .getByRole("button")
            .first()
            .click();
          await dialog.waitFor();
          const motion = await dialog.evaluate((el) => {
            const style = getComputedStyle(el);
            return {
              animation: style.animationName,
              transitionDurations: style.transitionDuration
                .split(",")
                .map(Number.parseFloat),
            };
          });
          if (reducedMotion === "reduce") {
            assert.equal(motion.animation, "none");
            assert.ok(
              motion.transitionDurations.every((duration) => duration === 0),
            );
          } else assert.notEqual(motion.animation, "none");
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
        }
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
          "No horizontal mobile overflow",
        );
        assert.deepEqual(errors, []);
        passed.push(
          `${locale} ${width}px: skip link, search keyboard/IME/pointer, modal focus, reduced motion`,
        );
      } finally {
        await context.close();
      }
    }
  }

  for (const locale of ["ko", "en"]) {
    const context = await newContext(locale, 390, "allow");
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    try {
      // A static page does not register a worker: seed a previous cache before activation.
      await page.goto(new URL(`/offline/${locale}.html`, base).href);
      await page.evaluate(async () => {
        await caches.open("ottline-cache-v6");
        await caches.open("unrelated-origin-cache");
      });
      await openHome(page, locale);
      await seedRecord(page);
      await page.waitForFunction(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return (
          registration?.active?.state === "activated" &&
          Boolean(navigator.serviceWorker.controller)
        );
      });
      const cacheNames = await page.evaluate(() => caches.keys());
      assert.ok(cacheNames.includes("ottline-cache-v7"));
      assert.ok(
        !cacheNames.includes("ottline-cache-v6"),
        "Activation removes the old application cache",
      );
      assert.ok(
        cacheNames.includes("unrelated-origin-cache"),
        "Unrelated caches must survive activation",
      );
      await page.reload({ waitUntil: "networkidle" });
      await page.getByTestId("home-featured").waitFor();
      const offlineResponseInfo = await page.evaluate(async (language) => {
        const response = await (await caches.open("ottline-cache-v7")).match(
          `/offline/${language}.html`,
        );
        return { redirected: response.redirected, status: response.status };
      }, locale);
      assert.deepEqual(offlineResponseInfo, { redirected: false, status: 200 });
      await context.setOffline(true);
      const response = await page.reload({ waitUntil: "domcontentloaded" });
      assert.equal(response.status(), 200);
      assert.equal(response.fromServiceWorker(), true);
      assert.equal(await page.locator("html").getAttribute("lang"), locale);
      assert.match(
        await page.locator("h1").innerText(),
        locale === "ko" ? /오프라인|연결/ : /offline|connection/i,
      );
      assert.equal(
        await page
          .locator('script[src], link[rel="stylesheet"], img[src], iframe')
          .count(),
        0,
        "Offline notice must not require network assets",
      );
      await context.setOffline(false);
      await page.reload({ waitUntil: "networkidle" });
      await page.getByTestId("home-featured").waitFor();
      assert.equal(
        await page.getByTestId("home-featured").getAttribute("data-log-id"),
        log.id,
      );
      passed.push(
        `${locale}: cold offline notice, reconnect and local record retained`,
      );
    } finally {
      await context.close();
    }
  }
  console.log(JSON.stringify({ passed }, null, 2));
} finally {
  await browser.close();
}
