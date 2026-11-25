/** Local built UI only. API/storage fixtures never touch production data. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, webkit } from "playwright";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3220");
assert.ok(
  base.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname),
);
const output =
  process.env.STORE_QA_OUTPUT ?? "/tmp/ottline-windows-acquisition";
await mkdir(output, { recursive: true });
const browserType =
  process.env.STORE_QA_BROWSER === "webkit" ? webkit : chromium;
const browser = await browserType.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: browserType === chromium ? ["--no-sandbox"] : [],
});
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/143.0 Safari/537.36 Edg/143.0";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/143.0 Mobile Safari/537.36";
const IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 Version/18.2 Mobile/15E148 Safari/604.1";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.2 Safari/605.1.15";
const LINUX =
  "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 Chrome/143.0 Safari/537.36";
const IOS_CHROME = IOS.replace("Version/18.2", "CriOS/143.0");
const MAC_CHROME = MAC.replace("Version/18.2", "Chrome/143.0");
const DISMISSED_KEY = "ottline.windowsStoreCta.dismissedAt";
const title = {
  id: "10000000-0000-4000-8000-000000000031",
  provider: "TMDB",
  providerId: "27205",
  type: "movie",
  name: "Store conversion test",
  year: 2010,
  posterUrl: null,
  genres: [],
};

async function until(condition, message) {
  for (let i = 0; i < 100; i++) {
    if (await condition()) return;
    await delay(50);
  }
  assert.fail(message);
}

async function fixture({
  userAgent = WINDOWS,
  locale = "ko",
  width = 1440,
  standalone = false,
  maxTouchPoints = 0,
  cooldownKey = DISMISSED_KEY,
  failOutbox = false,
  canonicalId = null,
  cooldown = null,
  twa = false,
  storageBlocked = false,
} = {}) {
  const context = await browser.newContext({
    userAgent,
    viewport: { width, height: 1000 },
    locale: locale === "en" ? "en-US" : "ko-KR",
    timezoneId: "Asia/Seoul",
    serviceWorkers: "block",
    reducedMotion: "reduce",
  });
  const events = [];
  const errors = [];
  let log = null;
  const canonicalPull = Promise.withResolvers();
  await context.addInitScript(
    ({
      standalone,
      cooldown,
      twa,
      storageBlocked,
      key,
      maxTouchPoints,
      failOutbox,
    }) => {
      Object.defineProperty(navigator, "maxTouchPoints", {
        value: maxTouchPoints,
      });
      if (failOutbox) {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          if (this.name === "outbox")
            throw new DOMException("Fixture", "QuotaExceededError");
          return put.apply(this, args);
        };
      }
      const media = window.matchMedia.bind(window);
      window.matchMedia = (query) =>
        query === "(display-mode: standalone)"
          ? Object.defineProperty(media(query), "matches", {
              value: standalone,
            })
          : media(query);
      localStorage.setItem(
        "watchlog.userId",
        "30000000-0000-4000-8000-000000000031",
      );
      localStorage.setItem(
        "watchlog.deviceId",
        "40000000-0000-4000-8000-000000000031",
      );
      localStorage.setItem("watchlog.pairingCode", "PRIVATE-TEST-CODE");
      if (cooldown && !localStorage.getItem(key))
        localStorage.setItem(key, cooldown);
      if (twa)
        sessionStorage.setItem("ottline.android.googlePlayTwaSession", "1");
      if (storageBlocked) {
        Storage.prototype.getItem = () => {
          throw new DOMException("Blocked", "SecurityError");
        };
        Storage.prototype.setItem = () => {
          throw new DOMException("Blocked", "SecurityError");
        };
      }
    },
    {
      standalone,
      cooldown,
      twa,
      storageBlocked,
      key: cooldownKey,
      maxTouchPoints,
      failOutbox,
    },
  );
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base.origin) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const path = url.pathname.slice(4);
    const reply = (value) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(value),
      });
    if (path === "/nalytic/events") {
      events.push(request.postDataJSON());
      return reply({});
    }
    if (path === "/titles/search") return reply([title]);
    if (path === "/titles/popular") return reply([]);
    if (path === "/sync/push") {
      const changes = request.postDataJSON().changes.logs;
      for (const item of changes)
        log = {
          ...item.payload,
          id: canonicalId ?? item.id,
          titleId: title.id,
          createdAt: item.updatedAt,
          updatedAt: item.updatedAt,
        };
      return reply({ accepted: changes.map((item) => item.id), rejected: [] });
    }
    if (path === "/sync/pull") {
      if (log && canonicalId) await canonicalPull.promise;
      return reply({
        serverTime: new Date().toISOString(),
        changes: { titles: log ? [title] : [], logs: log ? [log] : [] },
      });
    }
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
  page.on("pageerror", (error) => errors.push(error.message));
  const seen = (eventName, placement) =>
    events.filter(
      (event) =>
        event.eventName === eventName &&
        event.properties.placement === placement,
    );
  return {
    context,
    page,
    events,
    errors,
    seen,
    locale,
    releaseCanonical: canonicalPull.resolve,
  };
}

async function installEvent(page) {
  return page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    window.installPromptCalls = 0;
    Object.assign(event, {
      prompt: async () => {
        window.installPromptCalls += 1;
      },
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

function checkWindowsUrl(href, locale, campaign) {
  const url = new URL(href);
  assert.equal(url.origin, "https://apps.microsoft.com");
  assert.equal(url.pathname, "/detail/9nsvnzgdmgf5");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    hl: locale === "en" ? "en-us" : "ko-kr",
    gl: locale === "en" ? "US" : "KR",
    cid: campaign,
  });
  assert.doesNotMatch(
    decodeURIComponent(href),
    /PRIVATE|pairing|userId|deviceId|recordId/,
  );
}

function checkAppleUrl(href, locale, device) {
  const region = locale === "ko" ? "/kr" : "";
  const path =
    device === "mac"
      ? "/app/id6780318110?platform=mac"
      : "/app/ottline/id6780318110";
  assert.equal(href, `https://apps.apple.com${region}${path}`);
}

function checkAppleEvent(event, locale, device) {
  assert.equal(event.platform, "web");
  assert.equal(event.properties.locale, locale);
  assert.equal(event.properties.targetDevice, device);
  assert.equal(event.properties.osFamily, device === "mac" ? "macos" : "ios");
  assert.equal(
    event.properties.deviceType,
    { iphone: "mobile", ipad: "tablet", mac: "desktop" }[device],
  );
  assert.doesNotMatch(JSON.stringify(event.properties), /PRIVATE/);
}

async function activateExternalLink(page, locator) {
  const popupPromise = page.waitForEvent("popup");
  await locator.click();
  const popup = await popupPromise;
  await popup.close();
}

let scenarios = 0;
try {
  for (const [locale, width, action] of [
    ["ko", 1440, "dismiss"],
    ["en", 390, "click"],
  ]) {
    const f = await fixture({ locale, width });
    try {
      await f.page.goto(
        `${base.origin}/${locale === "en" ? "en" : ""}?userId=PRIVATE-URL`,
      );
      const banner = f.page.getByTestId("store-install-banner");
      await banner.waitFor();
      assert.equal(
        await banner.getAttribute("data-store-platform"),
        "windows-store",
      );
      assert.match(await banner.innerText(), /Ctrl\+Shift\+O/);
      const link = f.page.getByTestId("store-install-link");
      checkWindowsUrl(
        await link.getAttribute("href"),
        locale,
        "web_global_banner",
      );
      await until(
        () =>
          f.seen("windows_store_cta_impression", "global_install_banner")
            .length === 1,
        "One global impression",
      );
      const box = await banner.boundingBox();
      assert.ok(
        box.x >= 0 && box.x + box.width <= width + 1,
        "Banner fits the viewport",
      );
      assert.ok(
        (await link.boundingBox()).height >= 48,
        "Store link touch height",
      );
      await f.page.screenshot({
        path: join(output, `windows-banner-${locale}.png`),
      });
      assert.equal(await installEvent(f.page), true);
      assert.equal(
        await banner.getAttribute("data-store-platform"),
        "windows-store",
      );
      if (action === "click") await activateExternalLink(f.page, link);
      else await f.page.getByTestId("store-install-dismiss").click();
      await until(
        () =>
          f.seen(`windows_store_cta_${action}`, "global_install_banner")
            .length === 1,
        "CTA interaction recorded once",
      );
      await banner.waitFor({ state: "detached" });
      assert.ok(
        Number(
          await f.page.evaluate(
            (key) => localStorage.getItem(key),
            DISMISSED_KEY,
          ),
        ) > 0,
      );
      await f.page.reload();
      await installEvent(f.page);
      await delay(200);
      assert.equal(
        await banner.count(),
        0,
        "Cooldown cannot fall back to PWA installation",
      );
      assert.equal(
        f.seen("windows_store_cta_impression", "global_install_banner").length,
        1,
      );
      assert.deepEqual(f.errors, []);
      scenarios++;
    } finally {
      await f.context.close();
    }
  }

  for (const item of [
    { name: "windows-standalone", standalone: true, expected: null },
    {
      name: "windows-toss",
      userAgent: `${WINDOWS} TossApp/5.0`,
      expected: null,
    },
    {
      name: "windows-webview",
      userAgent: `${WINDOWS} WebView2`,
      expected: null,
    },
    {
      name: "windows-expired",
      cooldown: String(Date.now() - 15 * 86400000),
      expected: "windows-store",
    },
    { name: "android", userAgent: ANDROID, expected: "android-play" },
    {
      name: "android-pwa",
      userAgent: ANDROID,
      standalone: true,
      expected: "android-play",
    },
    { name: "twa", userAgent: ANDROID, twa: true, expected: null },
    { name: "ios-smart-banner", userAgent: IOS, expected: null },
    {
      name: "ipad-desktop-smart-banner",
      userAgent: MAC,
      maxTouchPoints: 5,
      expected: null,
    },
    { name: "ios-pwa", userAgent: IOS, standalone: true, expected: null },
    { name: "mac-pwa", userAgent: MAC, standalone: true, expected: null },
    {
      name: "mac-webview",
      userAgent: MAC.replace(/Version.*$/, ""),
      expected: null,
    },
    { name: "mac", userAgent: MAC, expected: "macos-appstore" },
    { name: "linux", userAgent: LINUX, expected: "browser-pwa" },
  ]) {
    const f = await fixture(item);
    try {
      await f.page.goto(`${base.origin}/about`);
      await f.page.getByTestId("about-windows-store-link").waitFor();
      await delay(150);
      if (item.expected === "browser-pwa")
        assert.equal(
          await f.page.getByTestId("store-install-banner").count(),
          0,
        );
      await installEvent(f.page);
      await delay(150);
      const banner = f.page.getByTestId("store-install-banner");
      if (item.expected) {
        assert.equal(
          await banner.getAttribute("data-store-platform"),
          item.expected,
          item.name,
        );
        if (item.expected === "browser-pwa") {
          await banner
            .getByRole("button", { name: "설치", exact: true })
            .click();
          assert.equal(
            await f.page.evaluate(() => window.installPromptCalls),
            1,
          );
          await banner.waitFor({ state: "detached" });
        }
      } else assert.equal(await banner.count(), 0, item.name);
      assert.deepEqual(f.errors, [], item.name);
      scenarios++;
    } finally {
      await f.context.close();
    }
  }

  for (const item of [
    {
      userAgent: IOS,
      device: "iphone",
      locale: "ko",
      width: 390,
      page: "/",
      action: "click",
    },
    {
      userAgent: IOS_CHROME,
      device: "iphone",
      locale: "en",
      page: "/en",
      action: "dismiss",
    },
    {
      userAgent: MAC,
      maxTouchPoints: 5,
      device: "ipad",
      locale: "ko",
      page: "/guide/ott-watch-log",
      action: "dismiss",
    },
    {
      userAgent: MAC_CHROME,
      maxTouchPoints: 5,
      device: "ipad",
      locale: "en",
      page: "/en/guide/ott-watch-log",
      action: "click",
    },
    {
      userAgent: MAC,
      device: "mac",
      locale: "en",
      page: "/en",
      action: "click",
    },
    {
      userAgent: MAC_CHROME,
      device: "mac",
      locale: "ko",
      page: "/",
      action: "dismiss",
    },
  ]) {
    const f = await fixture(item);
    try {
      const platform =
        item.device === "mac" ? "macos-appstore" : "ios-appstore";
      const prefix = platform.replace("-", "_") + "_cta";
      await f.page.goto(base.origin + item.page + "?recordId=PRIVATE");
      const banner = f.page.getByTestId("store-install-banner");
      const link = banner.getByTestId("store-install-link");
      await link.waitFor();
      assert.equal(await banner.getAttribute("data-store-platform"), platform);
      checkAppleUrl(await link.getAttribute("href"), item.locale, item.device);
      await until(
        () =>
          f.seen(`${prefix}_impression`, "global_install_banner").length === 1,
        "One owned Apple banner impression",
      );
      checkAppleEvent(
        f.seen(`${prefix}_impression`, "global_install_banner")[0],
        item.locale,
        item.device,
      );
      await installEvent(f.page);
      assert.equal(await banner.count(), 1);
      if (item.action === "click") await activateExternalLink(f.page, link);
      else await f.page.getByTestId("store-install-dismiss").click();
      await until(
        () =>
          f.seen(`${prefix}_${item.action}`, "global_install_banner").length ===
          1,
        "One global Apple interaction",
      );
      await banner.waitFor({ state: "detached" });
      await f.page.waitForLoadState("networkidle");
      await f.page.reload({ waitUntil: "networkidle" });
      await f.page.locator("h1").waitFor();
      await installEvent(f.page);
      assert.equal(
        await banner.count(),
        0,
        "Dismissal persists after navigating or reinstall prompt",
      );
      const about = (item.locale === "en" ? "/en" : "") + "/about";
      await f.page.goto(base.origin + about);
      const directory = f.page.getByTestId(`about-${platform}-link`);
      await directory.scrollIntoViewIfNeeded();
      await until(
        () =>
          f.seen(`${prefix}_impression`, "about_platform_card").length === 1,
        "Matching Apple directory link was seen",
      );
      checkAppleUrl(
        await directory.getAttribute("href"),
        item.locale,
        item.device,
      );
      await activateExternalLink(f.page, directory);
      await until(
        () => f.seen(`${prefix}_click`, "about_platform_card").length === 1,
        "One directory click",
      );
      checkAppleEvent(
        f.seen(`${prefix}_click`, "about_platform_card")[0],
        item.locale,
        item.device,
      );
      const other = item.device === "mac" ? "ios" : "macos";
      assert.equal(
        f.seen(`${other}_appstore_cta_impression`, "about_platform_card")
          .length,
        0,
      );
      assert.equal(
        f.seen(`${prefix}_impression`, "global_install_banner").length,
        1,
      );
      assert.deepEqual(f.errors, []);
      scenarios++;
    } finally {
      await f.context.close();
    }
  }

  for (const [locale, width, captureType] of [
    ["ko", 1440, "video"],
    ["en", 390, "book"],
  ]) {
    const f = await fixture({ locale, width });
    try {
      const capturedTitle = "별 + 이야기 &handoff=1 #2";
      await f.page.setViewportSize({
        width,
        height: locale === "en" ? 650 : 900,
      });
      const params = new URLSearchParams({
        quick: "1",
        quick_focus: "1",
        capture_title: capturedTitle,
        capture_platform: "Disney+",
        capture_type: captureType,
        capture_source_url: "https://example.test/?token=PRIVATE-SOURCE",
        user_id: "PRIVATE-USER",
        device_id: "PRIVATE-DEVICE",
        pairing_code: "PRIVATE-CODE",
      });
      await f.page.goto(
        `${base.origin}/${locale === "en" ? "en" : ""}?${params}`,
      );
      const dialog = f.page.getByRole("dialog");
      const bridge = dialog.getByTestId("windows-quick-record-bridge");
      const search = dialog.getByTestId("title-search");
      const appLink = bridge.locator('a[href^="ottline:"]');
      const storeLink = bridge.locator('a[href^="https:"]');
      const preference = bridge.getByRole("checkbox");
      const appUrl = new URL(await appLink.getAttribute("href"));
      assert.equal(appUrl.protocol, "ottline:");
      assert.equal(appUrl.hostname, "quick");
      assert.equal(appUrl.hash, "");
      assert.deepEqual(Object.fromEntries(appUrl.searchParams), {
        quick: "1",
        title: capturedTitle,
        q: capturedTitle,
        platform: "Disney+",
        type: captureType,
      });
      checkWindowsUrl(
        await storeLink.getAttribute("href"),
        locale,
        "extension_handoff",
      );
      assert.equal(await search.inputValue(), capturedTitle);
      await until(
        () => search.evaluate((el) => el === document.activeElement),
        "Default capture entry focuses web title search",
      );
      assert.equal(await preference.isChecked(), false);
      await f.page.screenshot({
        path: join(output, `extension-${locale}.png`),
      });

      await preference.check();
      await f.page.reload();
      assert.equal(await preference.isChecked(), true);
      await until(
        () => appLink.evaluate((el) => el === document.activeElement),
        "Saved app preference focuses the app link on the next capture",
      );
      await appLink.evaluate((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          link.dataset.testLaunch = link.href;
        });
      });
      await f.page.keyboard.press("Enter");
      assert.equal(await appLink.getAttribute("data-test-launch"), appUrl.href);
      assert.equal(await search.inputValue(), capturedTitle);
      await activateExternalLink(f.page, storeLink);

      await preference.uncheck();
      await f.page.reload();
      assert.equal(await preference.isChecked(), false);
      await until(
        () => search.evaluate((el) => el === document.activeElement),
        "Clearing the preference restores search focus on the next capture",
      );

      if (locale === "ko") {
        await search.fill(title.name);
        await dialog.getByTestId("title-search-result").first().click();
        await bridge.waitFor({ state: "detached" });
        await dialog.getByTestId("record-status-DONE").click();
        await dialog.getByTestId("record-save-initial").click();
        await dialog.getByTestId("record-done").waitFor();
      }
      assert.deepEqual(f.errors, []);
      scenarios++;
    } finally {
      await f.context.close();
    }
  }

  for (const item of [
    { userAgent: MAC },
    { userAgent: ANDROID },
    { standalone: true },
    { userAgent: `${WINDOWS} WebView2` },
    { quick: "0" },
    { captureTitle: " " },
  ]) {
    const f = await fixture(item);
    try {
      const params = new URLSearchParams({
        quick: item.quick ?? "1",
        capture_title: item.captureTitle ?? title.name,
      });
      await f.page.goto(`${base.origin}/?${params}`);
      const dialog = f.page.getByRole("dialog");
      await dialog.getByTestId("title-search").waitFor();
      assert.equal(
        await dialog.getByTestId("windows-quick-record-bridge").count(),
        0,
      );
      assert.deepEqual(f.errors, []);
      scenarios++;
    } finally {
      await f.context.close();
    }
  }

  for (const item of [
    { name: "windows-ko", locale: "ko", expected: "windows-store" },
    { name: "windows-en", locale: "en", width: 390, expected: "windows-store" },
    { name: "windows-pwa", standalone: true, expected: null },
    { name: "windows-cooldown", cooldown: String(Date.now()), expected: null },
    {
      name: "windows-toss",
      userAgent: `${WINDOWS} TossApp/5.0`,
      expected: null,
    },
    { name: "android", userAgent: ANDROID, expected: "android-play" },
    {
      name: "iphone-safari",
      userAgent: IOS,
      locale: "ko",
      width: 390,
      expected: "ios-appstore",
      device: "iphone",
      action: "dismiss",
    },
    {
      name: "ipad-desktop",
      userAgent: MAC,
      maxTouchPoints: 5,
      locale: "en",
      expected: "ios-appstore",
      device: "ipad",
      action: "click",
    },
    {
      name: "mac-chrome",
      userAgent: MAC_CHROME,
      locale: "en",
      expected: "macos-appstore",
      device: "mac",
      action: "dismiss",
    },
    {
      name: "mac-safari",
      userAgent: MAC,
      locale: "ko",
      expected: "macos-appstore",
      device: "mac",
      action: "click",
    },
    {
      name: "ios-cooldown",
      userAgent: IOS,
      cooldown: String(Date.now()),
      cooldownKey: "ottline.iosAppStoreCta.dismissedAt",
      expected: null,
    },
    {
      name: "ios-standalone",
      userAgent: IOS,
      standalone: true,
      expected: null,
    },
    { name: "mac-embedded", userAgent: MAC + " Instagram 123", expected: null },
    { name: "failed-outbox", userAgent: IOS, failOutbox: true, expected: null },
  ]) {
    const f = await fixture(item);
    try {
      await f.page.goto(
        `${base.origin}/${f.locale === "en" ? "en" : ""}?quick=1`,
      );
      await f.page.getByTestId("title-search").fill(title.name);
      assert.equal(
        await f.page.getByTestId("windows-quick-record-bridge").count(),
        0,
      );
      await f.page.getByTestId("title-search-result").first().click();
      await f.page.getByTestId("record-status-DONE").click();
      assert.equal(
        await f.page
          .locator('[data-testid^="saved-"][data-testid$="-cta"]')
          .count(),
        0,
      );
      assert.equal(
        f.events.filter((e) => e.properties.placement === "quicklog_saved")
          .length,
        0,
      );
      await f.page.getByTestId("record-save-initial").click();
      if (item.failOutbox) {
        await f.page
          .getByRole("alert")
          .filter({ hasText: /.+/ })
          .first()
          .waitFor();
        assert.equal(
          await f.page.getByTestId("saved-ios-appstore-cta").count(),
          0,
        );
        assert.equal(
          f.events.filter(
            (e) =>
              e.eventName === "first_log_create" ||
              e.properties.placement === "quicklog_saved",
          ).length,
          0,
        );
        scenarios++;
        continue;
      }
      await f.page.getByTestId("record-done").waitFor();
      assert.equal(
        await f.page.getByTestId("store-install-banner").count(),
        0,
        "Recording hides global banner",
      );
      if (item.expected) {
        const link = f.page.getByTestId(`saved-${item.expected}-link`);
        await link.waitFor();
        await link.scrollIntoViewIfNeeded();
        const eventPrefix = item.expected.replace("-", "_") + "_cta";
        await until(
          () =>
            f.seen(`${eventPrefix}_impression`, "quicklog_saved").length === 1,
          "Saved impression recorded",
        );
        if (item.expected === "windows-store") {
          assert.match(
            await f.page.getByTestId("saved-windows-store-cta").innerText(),
            /Ctrl\+Shift\+O/,
          );
          checkWindowsUrl(
            await link.getAttribute("href"),
            f.locale,
            "web_quicklog_saved",
          );
          await link.scrollIntoViewIfNeeded();
          await f.page.screenshot({
            path: join(output, `saved-${item.name}.png`),
          });
          await activateExternalLink(f.page, link);
          await until(
            () => f.seen(`${eventPrefix}_click`, "quicklog_saved").length === 1,
            "Saved click recorded",
          );
          await link.waitFor({ state: "detached" });
          await f.page.getByTestId("record-done").click();
          assert.equal(
            await f.page.getByTestId("store-install-banner").count(),
            0,
            "Saved click also suppresses global CTA",
          );
        } else if (item.device) {
          checkAppleUrl(await link.getAttribute("href"), f.locale, item.device);
          checkAppleEvent(
            f.seen(`${eventPrefix}_impression`, "quicklog_saved")[0],
            f.locale,
            item.device,
          );
          if (item.action === "click") await activateExternalLink(f.page, link);
          else
            await f.page.getByTestId(`saved-${item.expected}-dismiss`).click();
          await until(
            () =>
              f.seen(`${eventPrefix}_${item.action}`, "quicklog_saved")
                .length === 1,
            "One saved Apple interaction",
          );
          await link.waitFor({ state: "detached" });
          await until(
            () =>
              f.events.filter((e) => e.eventName === "first_log_create")
                .length === 1,
            "First web record is independently measured",
          );
          assert.equal(
            f.seen(`${eventPrefix}_impression`, "global_install_banner").length,
            0,
            "Direct recording does not emit a global impression",
          );
          await f.page.goto(base.origin + (f.locale === "en" ? "/en" : "/"));
          await f.page.getByTestId("home-record").waitFor();
          assert.equal(
            await f.page.getByTestId("store-install-banner").count(),
            0,
            "Saved action also suppresses global banner on next visit",
          );
        } else {
          const referrer = new URLSearchParams(
            new URL(await link.getAttribute("href")).searchParams.get(
              "referrer",
            ),
          );
          assert.equal(referrer.get("utm_campaign"), "quicklog_saved");
          assert.equal(referrer.get("web_handoff"), "1");
        }
      } else {
        assert.equal(
          await f.page
            .locator('[data-testid^="saved-"][data-testid$="-cta"]')
            .count(),
          0,
          item.name,
        );
      }
      assert.deepEqual(f.errors, [], item.name);
      scenarios++;
    } finally {
      await f.context.close();
    }
  }

  // The first local record remains eligible across editing and canonical ID
  // refreshes. A subsequent record is ineligible even without a dismissal.
  {
    const canonicalId = "20000000-0000-4000-8000-000000000031";
    const f = await fixture({ userAgent: IOS, locale: "en", canonicalId });
    try {
      await f.page.goto(base.origin + "/en");
      await f.page.getByTestId("store-install-banner").waitFor();
      await f.page.getByTestId("home-first-record").click();
      const banner = f.page.getByTestId("store-install-banner");
      const link = f.page.getByTestId("saved-ios-appstore-link");
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt) await f.page.goto(base.origin + "/en?quick=1");
        await f.page.getByTestId("title-search").fill(title.name);
        await banner.waitFor({ state: "detached" });
        await f.page.getByTestId("title-search-result").first().click();
        await f.page.getByTestId("record-status-DONE").click();
        await f.page.getByTestId("record-save-initial").click();
        await f.page.getByTestId("record-done").waitFor();
        if (!attempt) {
          await link.scrollIntoViewIfNeeded();
          await until(
            () =>
              f.seen("ios_appstore_cta_impression", "quicklog_saved").length ===
              1,
            "First saved offer was seen",
          );
          f.releaseCanonical();
          await f.page
            .locator(
              `[data-testid="home-featured"][data-log-id="${canonicalId}"]`,
            )
            .waitFor({ state: "attached" });
          await f.page.getByTestId("record-edit-details").click();
          await f.page.getByRole("button", { name: "Maybe later" }).click();
          await link.scrollIntoViewIfNeeded();
        } else {
          assert.equal(
            await link.count(),
            0,
            "A subsequent local record has no Apple offer",
          );
        }
      }
      await until(
        () => f.events.filter((e) => e.eventName === "log_create").length === 2,
        "Both explicit saves are recorded",
      );
      assert.equal(
        f.events.filter((e) => e.eventName === "first_log_create").length,
        1,
      );
      assert.equal(
        f.seen("ios_appstore_cta_impression", "quicklog_saved").length,
        1,
      );
      assert.deepEqual(f.errors, []);
      scenarios++;
    } finally {
      f.releaseCanonical();
      await f.context.close();
    }
  }

  {
    const f = await fixture({ userAgent: IOS, locale: "en" });
    try {
      await f.page.goto(base.origin + "/en/privacy");
      await f.page.evaluate(() => {
        const frame = document.createElement("iframe");
        frame.src = "/en/about";
        frame.title = "Embedded directory";
        frame.style.cssText =
          "position:fixed;top:80px;left:80px;width:900px;height:780px;z-index:1000";
        document.body.prepend(frame);
      });
      const frame = f.page.frameLocator('iframe[title="Embedded directory"]');
      const directory = frame.getByTestId("about-ios-appstore-link");
      await directory.scrollIntoViewIfNeeded();
      await until(
        () =>
          frame.locator("body").evaluate((node) => {
            const event = new Event("beforeinstallprompt", {
              cancelable: true,
            });
            return !node.ownerDocument.defaultView.dispatchEvent(event);
          }),
        "Embedded acquisition surface has hydrated",
      );
      // The directory link is permanent in an embedded document. Exercise its
      // click handler without opening an external store from the test iframe.
      await directory.evaluate((link) =>
        link.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            link.dataset.clicked = "true";
          },
          { once: true },
        ),
      );
      await directory.click();
      assert.equal(await directory.getAttribute("data-clicked"), "true");
      assert.equal(await frame.getByTestId("store-install-banner").count(), 0);
      assert.equal(
        await f.page.getByTestId("store-install-banner").count(),
        0,
        "A private or utility route has no global Apple offer",
      );
      assert.equal(
        f.events.filter((e) => /appstore_cta/.test(e.eventName)).length,
        0,
      );
      assert.deepEqual(f.errors, []);
      scenarios++;
    } finally {
      await f.context.close();
    }
  }

  for (const locale of ["ko", "en"]) {
    const f = await fixture({ locale, cooldown: String(Date.now()) });
    try {
      await f.page.goto(`${base.origin}/${locale === "en" ? "en/" : ""}about`);
      const link = f.page.getByTestId("about-windows-store-link");
      await link.scrollIntoViewIfNeeded();
      checkWindowsUrl(
        await link.getAttribute("href"),
        locale,
        "about_platform_card",
      );
      await until(
        () =>
          f.seen("windows_store_cta_impression", "about_platform_card")
            .length === 1,
        "Visible about card impression",
      );
      await activateExternalLink(f.page, link);
      await until(
        () =>
          f.seen("windows_store_cta_click", "about_platform_card").length === 1,
        "About click recorded",
      );
      await f.page.screenshot({ path: join(output, `about-${locale}.png`) });
      assert.deepEqual(f.errors, []);
      scenarios++;
    } finally {
      await f.context.close();
    }
  }
  console.log(
    `Store acquisition runtime passed: ${scenarios} scenarios; screenshots: ${output}`,
  );
} finally {
  await browser.close();
}
