import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

// Run against a built local preview. No account or record is created.
const baseURL = process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3173";
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname),
);
const screenshots = await mkdtemp(join(tmpdir(), "ottline-recording-dialog-"));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  locale: "ko-KR",
  serviceWorkers: "block",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/api/**", (route) => {
  if (["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
    return route.continue();
  }
  // Includes incidental analytics and registration, so this stays read-only.
  return route.abort("blockedbyclient");
});

async function waitForFocus(testId) {
  await page.waitForFunction(
    (id) => document.activeElement?.getAttribute("data-testid") === id,
    testId,
  );
}

try {
  await page.goto(`${baseURL}/ko?quick=1`, { waitUntil: "domcontentloaded" });
  const dialog = page.getByRole("dialog");
  const input = page.getByTestId("title-search");
  await input.waitFor({ timeout: 25_000 });

  // A deep link has no opener. Closing must return to the page content.
  await page.getByRole("button", { name: "기록 창 닫기" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.waitForFunction(() =>
    document.activeElement?.matches("main, main h1"),
  );

  const trigger = page.getByTestId("home-first-record");
  await trigger.click();
  await input.waitFor();
  await page.getByRole("button", { name: "영화", exact: true }).click();
  await input.fill("인터스텔라");
  await page
    .getByTestId("title-search-result")
    .first()
    .waitFor({ timeout: 30_000 });

  await input.dispatchEvent("compositionstart", { data: "인" });
  await input.fill("인");
  await input.press("Enter");
  assert.equal(
    await dialog.getAttribute("data-record-stage"),
    "search",
    "Enter during IME composition must not select a title",
  );
  await input.fill("인터스텔라");
  await input.dispatchEvent("compositionend", { data: "인터스텔라" });
  await page
    .getByTestId("title-search-result")
    .first()
    .waitFor({ timeout: 30_000 });

  await input.evaluate((node) => {
    node.dataset.identity = "same-input";
  });
  // Chromium does not open a physical keyboard here. Simulate its visible viewport.
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
  await page.waitForFunction(() => {
    const box = document
      .querySelector('[role="dialog"]')
      ?.getBoundingClientRect();
    return box && Math.abs(box.y - 90) < 1 && box.height <= 401;
  });
  const after = await input.evaluate((node) => ({
    identity: node.dataset.identity,
    value: node.value,
    top: node.getBoundingClientRect().top,
    focused: document.activeElement === node,
  }));
  assert.equal(after.identity, "same-input");
  assert.equal(after.value, "인터스텔라");
  assert.ok(after.focused);
  assert.ok(after.top >= 90 && after.top < 490);
  await page.screenshot({ path: join(screenshots, "search-mobile.png") });

  // Selecting a title or status is read-only; the footer has the final save action.
  await page.getByTestId("title-search-result").first().click();
  await page.getByTestId("record-status-DONE").waitFor();
  assert.equal(await dialog.getAttribute("data-record-stage"), "status");
  const statusBox = await dialog.boundingBox();
  assert.ok(statusBox.y >= 90);
  assert.ok(statusBox.y + statusBox.height <= 491);
  await page.screenshot({ path: join(screenshots, "status-mobile.png") });

  await page.getByRole("button", { name: "기록 창 닫기" }).click();
  await dialog.waitFor({ state: "hidden" });
  await waitForFocus("home-first-record");
  await page.evaluate(() => {
    delete window.visualViewport.height;
    delete window.visualViewport.offsetTop;
    window.visualViewport.dispatchEvent(new Event("resize"));
  });

  await trigger.click();
  await input.waitFor();
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
    assert.ok(
      await dialog.evaluate((node) => node.contains(document.activeElement)),
    );
  }
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await waitForFocus("home-first-record");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      result: "PASS",
      checks: [
        "IME",
        "viewport",
        "stable input",
        "focus trap",
        "opener",
        "deep link fallback",
      ],
      screenshots,
    }),
  );
} catch (error) {
  await page.screenshot({ path: join(screenshots, "failure.png") });
  console.error(JSON.stringify({ result: "FAIL", errors, screenshots }));
  throw error;
} finally {
  await browser.close();
}
