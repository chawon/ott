/** Actual search UI, isolated API: composing text must search before Space/Enter. */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:4173");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});

async function poll(read, accept, label, timeout = 1500) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await read();
    if (accept(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(label);
}

async function compose(input, value) {
  await input.evaluate((node, text) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(node, text);
    node.dispatchEvent(
      new CompositionEvent("compositionupdate", { bubbles: true, data: text }),
    );
    node.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: text,
        inputType: "insertCompositionText",
        isComposing: true,
      }),
    );
  }, value);
}

const cases = [];
try {
  for (const width of [390, 1440]) {
    for (const type of ["all", "movie", "book"]) {
      const context = await browser.newContext({
        locale: "ko-KR",
        viewport: { width, height: 900 },
        serviceWorkers: "block",
      });
      const searches = [];
      const errors = [];
      await context.route("**/api/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.method() !== "GET") return route.fulfill({ status: 204 });
        if (url.pathname === "/api/titles/search") {
          const query = url.searchParams.get("q");
          const book = url.searchParams.get("type") === "book";
          searches.push({ query, type: book ? "book" : "movie" });
          return route.fulfill({
            json: [
              {
                id: book
                  ? "10000000-0000-4000-8000-000000000002"
                  : "10000000-0000-4000-8000-000000000001",
                provider: book ? "KAKAO" : "TMDB",
                providerId: book ? "9780000000001" : "27205",
                type: book ? "book" : "movie",
                name: `${query} 검색 후보`,
                year: 2010,
                genres: [],
                posterUrl: null,
              },
            ],
          });
        }
        return route.fulfill({ json: [] });
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base.origin}/ko?quick=1`, {
        waitUntil: "domcontentloaded",
      });
      const input = page.getByTestId("title-search");
      await input.waitFor();
      if (type !== "all")
        await page
          .getByRole("button", {
            name: type === "book" ? "책" : "영화",
            exact: true,
          })
          .click();

      await input.dispatchEvent("compositionstart", { data: "" });
      await compose(input, "인셉");
      assert.equal(await input.inputValue(), "인셉");
      await poll(
        () => searches.some((search) => search.query === "인셉"),
        Boolean,
        `${width}/${type}: Korean text must search during composition, before Space or compositionend`,
      );
      await poll(
        () => page.getByTestId("title-search-result").first().textContent(),
        (text) => text?.includes("인셉 검색 후보"),
        "The first composing query must show its own results",
      );

      await compose(input, "인셉션");
      await poll(
        () => searches.some((search) => search.query === "인셉션"),
        Boolean,
        "Further composing characters must refresh search without a space",
      );
      await poll(
        () => page.getByTestId("title-search-result").first().textContent(),
        (text) => text?.includes("인셉션 검색 후보"),
        "The composing query must update the visible candidates",
      );
      await input.press("Enter");
      assert.equal(
        await page.getByRole("dialog").getAttribute("data-record-stage"),
        "search",
        "IME Enter must not select a title",
      );
      await input.dispatchEvent("compositionend", { data: "인셉션" });
      await page.waitForTimeout(350);
      const expectedRequests = type === "all" ? 4 : 2;
      assert.equal(
        searches.length,
        expectedRequests,
        "Composition end must not repeat the same completed search",
      );
      assert.ok(
        await input.evaluate((node) => node === document.activeElement),
      );
      await input.press("Enter");
      await page.getByTestId("record-status-DONE").waitFor();
      assert.deepEqual(errors, []);
      cases.push({
        width,
        type,
        composingQueries: 2,
        requests: searches.length,
      });
      await context.close();
    }
  }
  console.log(JSON.stringify({ result: "PASS", cases, realApiWrites: 0 }));
} finally {
  await browser.close();
}
