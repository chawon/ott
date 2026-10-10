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
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
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

  for (const locale of ["ko", "en"]) {
    await page.goto(
      new URL(locale === "ko" ? "/about" : "/en/about", baseUrl).href,
    );
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const navigation = page.locator(
        width === 390 ? ".app-bottom-nav" : ".app-top-nav",
      );
      await navigation.waitFor({ state: "visible" });
      const links = navigation.getByRole("link");
      assert.equal(await links.count(), 4, "Four navigation actions render");
      for (const link of await links.all()) {
        const label = (await link.innerText()).trim();
        assert.ok(label, "Each icon has a visible navigation label");
        assert.equal(
          await navigation
            .getByRole("link", { name: label, exact: true })
            .count(),
          1,
          "Hiding decorative icons preserves the accessible link name",
        );
        const icon = link.locator("svg.lucide");
        assert.equal(await icon.count(), 1);
        assert.equal(await icon.getAttribute("aria-hidden"), "true");
        assert.ok(
          await icon.locator("path, circle, line, rect, polyline").count(),
        );
        const iconBox = await icon.boundingBox();
        assert.ok(iconBox?.width >= 16 && iconBox.width <= 24);
        assert.ok(iconBox?.height >= 16 && iconBox.height <= 24);
        if (width === 390) {
          const labelBox = await link
            .locator(".bottom-nav-label")
            .boundingBox();
          assert.ok(labelBox?.y >= iconBox.y + iconBox.height - 1);
          assert.ok((await link.boundingBox())?.height >= 48);
        }
      }
      const themeButton = page.locator("header button:has(svg.lucide)");
      const name = await themeButton.getAttribute("aria-label");
      assert.ok(name, "The icon-only theme button has an accessible name");
      assert.equal(
        await page.getByRole("button", { name, exact: true }).count(),
        1,
      );
      const oldTheme = await themeButton.locator("svg").getAttribute("class");
      await themeButton.click();
      await page.waitForFunction(
        (previous) =>
          document
            .querySelector("header button svg.lucide")
            ?.getAttribute("class") !== previous,
        oldTheme,
      );
      assert.equal(
        await themeButton.locator("svg").getAttribute("aria-hidden"),
        "true",
      );
      assert.ok(
        await page
          .locator("main svg.lucide path, main svg.lucide circle")
          .count(),
        "About page platform icons render",
      );
      console.log(
        `PASS: ${locale} icons, labels, and theme action at ${width}px`,
      );
    }
  }
  assert.deepEqual(errors, [], "No browser hydration or runtime errors");
  console.log(
    "PASS: locale switches, saved locale reload, and browser hydration",
  );
} finally {
  await browser.close();
}
