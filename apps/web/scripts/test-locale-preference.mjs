/** An explicit language choice wins over browser language across real menu clicks.
 * All account/API traffic is isolated; only the local preview serves app assets.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3000");
assert.ok(
  (base.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(base.hostname)) ||
    (process.env.LOCALE_QA_ALLOW_PREVIEW === "1" &&
      ["http:", "https:"].includes(base.protocol) &&
      ["172.24.75.199", "unmellow-dimple-untouchably.ngrok-free.dev"].includes(
        base.hostname,
      )),
);
const browserLocale = process.env.LOCALE_QA_BROWSER ?? "en-US";
const chosenLocale = process.env.LOCALE_QA_CHOICE ?? "ko";
const width = Number(process.env.LOCALE_QA_WIDTH ?? 1440);
const output =
  process.env.LOCALE_QA_OUTPUT ?? join(tmpdir(), "ottline-locale-preference");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
const steps = [],
  errors = [],
  localeResponses = [],
  responseTasks = [];
let context;
try {
  context = await browser.newContext({
    viewport: { width, height: 1000 },
    locale: browserLocale,
    serviceWorkers: "block",
    extraHTTPHeaders: { "ngrok-skip-browser-warning": "1" },
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      "watchlog.userId",
      "30000000-0000-4000-8000-000000000051",
    );
    localStorage.setItem(
      "watchlog.deviceId",
      "40000000-0000-4000-8000-000000000051",
    );
    localStorage.setItem("watchlog.pairingCode", "ISOLATED-LANGUAGE");
  });
  await context.route("**/*", (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      if (request.method() !== "GET") return route.fulfill({ status: 204 });
      if (url.pathname === "/api/auth/profile")
        return route.fulfill({
          json: { nickname: null, personaKey: "book_drifter" },
        });
      if (url.pathname === "/api/sync/pull")
        return route.fulfill({
          json: {
            serverTime: new Date().toISOString(),
            changes: { titles: [], logs: [] },
          },
        });
      if (url.pathname === "/api/logs/page")
        return route.fulfill({ json: { items: [], nextCursor: null } });
      return route.fulfill({ json: [] });
    }
    return url.origin === base.origin ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) =>
    responseTasks.push(
      (async () => {
        const cookie = (await response.allHeaders())["set-cookie"];
        const match = cookie?.match(/(?:^|,\s*)NEXT_LOCALE=([^;]+)/);
        if (match) {
          const headers = await response.request().allHeaders();
          localeResponses.push({
            path: new URL(response.url()).pathname,
            cookie: match[1],
            rsc: headers.rsc ?? null,
            accept: headers.accept ?? null,
            destination: headers["sec-fetch-dest"] ?? null,
          });
        }
      })(),
    ),
  );
  async function snapshot(step) {
    const entry = {
      step,
      path: new URL(page.url()).pathname,
      locale: await page.locator("html").getAttribute("lang"),
      cookie:
        (await context.cookies()).find((item) => item.name === "NEXT_LOCALE")
          ?.value ?? null,
    };
    steps.push(entry);
    console.log(JSON.stringify(entry));
    return entry;
  }
  await page.goto(base.origin, { waitUntil: "domcontentloaded" });
  await page.locator("header button[lang]").first().waitFor();
  const initial = await snapshot("browser default");
  assert.equal(initial.locale, browserLocale.startsWith("ko") ? "ko" : "en");
  if (process.env.LOCALE_QA_WARM_MENUS === "1") {
    const initialNav = page.locator(
      width < 768 ? ".app-bottom-nav" : ".app-top-nav",
    );
    for (const path of ["/timeline", "/public", "/account"]) {
      await initialNav.locator(`a[href$="${path}"]`).click();
      await initialNav
        .locator(`a[href$="${path}"][aria-current="page"]`)
        .waitFor();
    }
    await snapshot("menus visited before choice");
  }
  await page.locator(`header button[lang="${chosenLocale}"]`).click();
  await page.waitForFunction(
    (locale) => document.documentElement.lang === locale,
    chosenLocale,
  );
  await page.waitForTimeout(1000);
  await snapshot("explicit choice");
  const nav = page.locator(width < 768 ? ".app-bottom-nav" : ".app-top-nav");
  for (const path of ["/timeline", "/public", "/account", "/"]) {
    const suffix =
      path === "/" ? 'a[href="/"], a[href="/en"]' : `a[href$="${path}"]`;
    await nav.locator(suffix).click();
    await nav
      .locator(
        `${suffix
          .split(", ")
          .map((selector) => `${selector}[aria-current="page"]`)
          .join(", ")}`,
      )
      .waitFor();
    await page.waitForTimeout(200);
    const state = await snapshot(`menu ${path}`);
    assert.equal(
      state.locale,
      chosenLocale,
      `Menu ${path} must preserve the explicit locale`,
    );
    assert.equal(
      state.cookie,
      chosenLocale,
      "Saved locale must survive background navigation",
    );
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal((await snapshot("reload")).locale, chosenLocale);
  await page.goto(new URL("/timeline", base).href, {
    waitUntil: "domcontentloaded",
  });
  assert.equal((await snapshot("unprefixed entry")).locale, chosenLocale);
  const nextPage = await context.newPage();
  await nextPage.goto(base.origin, { waitUntil: "domcontentloaded" });
  assert.equal(
    await nextPage.locator("html").getAttribute("lang"),
    chosenLocale,
    "New tabs use the saved choice",
  );
  assert.deepEqual(errors, []);
  await page.screenshot({ path: join(output, "screen.png") });
} finally {
  await Promise.all(responseTasks);
  await writeFile(
    join(output, "result.json"),
    JSON.stringify(
      {
        browserLocale,
        chosenLocale,
        width,
        steps,
        localeResponses,
        errors,
        actualApiWrites: 0,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
