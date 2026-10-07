import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3000");
assert.ok(
  baseUrl.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(baseUrl.hostname),
  "Locale verification must use a local server",
);

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", (route) =>
    route.fulfill({ contentType: "application/json", body: "{}" }),
  );
  await page.goto(new URL("/en/about", baseUrl).href);

  for (let cycle = 0; cycle < 3; cycle += 1) {
    for (const locale of ["ko", "en"]) {
      await page.locator(`header button[lang="${locale}"]`).click();
      await page.waitForFunction(
        (expected) => document.documentElement.lang === expected,
        locale,
      );
      // Next.js 16.3 revalidates previously visited routes after navigation.
      // Allow those background requests to run before checking the saved locale.
      await page.waitForTimeout(1000);
      const cookie = (await context.cookies()).find(
        (entry) => entry.name === "NEXT_LOCALE",
      );
      assert.equal(
        cookie?.value,
        locale,
        "Background requests preserve locale",
      );
      const expectedPath = locale === "ko" ? "/about" : "/en/about";
      assert.equal(new URL(page.url()).pathname, expectedPath);

      await page.reload();
      assert.equal(await page.locator("html").getAttribute("lang"), locale);
      assert.equal(new URL(page.url()).pathname, expectedPath);
    }
  }
  assert.deepEqual(errors, [], "No browser hydration or runtime errors");
  console.log(
    "PASS: locale switches, saved locale reload, and browser hydration",
  );
} finally {
  await browser.close();
}
