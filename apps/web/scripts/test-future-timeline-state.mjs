/** Rendered Future timeline + real IndexedDB, with every API call intercepted. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3000");
assert.ok(
  base.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(base.hostname),
);
const scenario = process.env.FUTURE_QA_CASE ?? "quota";
const locale = process.env.FUTURE_QA_LOCALE === "en" ? "en" : "ko";
const copy = (ko, en) => (locale === "ko" ? ko : en);
assert.ok(
  [
    "quota",
    "generation",
    "retry",
    "empty",
    "pending",
    "cross-device",
    "scope",
    "legacy",
    "catalog",
    "concurrent",
    "locale-pending",
  ].includes(scenario),
);
const output =
  process.env.FUTURE_QA_OUTPUT ??
  join(tmpdir(), `ottline-future-state-${scenario}`);
await mkdir(output, { recursive: true });
const firstUser = "30000000-0000-4000-8000-000000000071";
const secondUser = "30000000-0000-4000-8000-000000000072";
const title = {
  name: "A story for another day",
  type: "movie",
  reason: "A quiet story.",
  genres: [],
  provider: "TMDB",
  providerId: "101",
  year: 2001,
  posterUrl: null,
};
const series = { ...title, name: "A series for another day", type: "series" };
const videoCatalog = {
  ...title,
  overview: "A catalog-confirmed story.",
  titleId: "10000000-0000-4000-8000-000000000071",
};
const book = {
  name: "The Little Prince",
  originalName: "The Little Prince",
  type: "book",
  reason: "A few pages to keep.",
  author: "Antoine de Saint-Exupéry",
  genres: [],
  year: 1943,
  posterUrl: null,
};
const editions = [
  {
    provider: "KAKAO",
    providerId: "9780156012195",
    type: "book",
    name: "The Little Prince",
    author: "Antoine de Saint-Exupéry",
    publisher: "Paperback House",
    isbn13: "9780156012195",
    year: 2000,
    posterUrl: null,
  },
  {
    provider: "KAKAO",
    providerId: "9780141185620",
    type: "book",
    name: "The Little Prince",
    author: "Antoine de Saint-Exupéry",
    publisher: "Hardcover House",
    isbn13: "9780141185620",
    year: 2010,
    posterUrl: null,
  },
];
const calls = [],
  errors = [];
const clone = (value) => structuredClone(value);
function makeState(items = [title, series]) {
  return {
    items: clone(items),
    exclusions: [],
    quota: {
      date: "2026-11-08",
      timezone: "Asia/Seoul",
      limit: 3,
      used: 1,
      remaining: 2,
      resetsAt: "2026-11-08T15:00:00Z",
    },
    generatedAt: "2026-11-08T01:00:00Z",
    generationId: "50000000-0000-4000-8000-000000000071",
    generating: false,
    hasBatch: true,
    eligible: true,
  };
}
const states = new Map([
  [
    firstUser,
    makeState(
      scenario === "catalog"
        ? [{ ...title, catalogTitle: videoCatalog }, book]
        : [title, series],
    ),
  ],
  [secondUser, makeState([{ ...series, name: "Another account's stories" }])],
]);
const state = states.get(firstUser);
if (scenario === "quota") {
  state.quota.used = 3;
  state.quota.remaining = 0;
}
if (
  ["generation", "retry", "concurrent", "locale-pending"].includes(scenario)
) {
  state.items = [];
  state.hasBatch = false;
  state.generatedAt = null;
  state.generationId = null;
  state.quota.used = 0;
  state.quota.remaining = 3;
}
if (scenario === "empty") state.items = [];
const completed = new Set();
let generationAttempts = 0,
  readCount = 0;
let releaseFirst;
const firstRead = new Promise((resolve) => {
  releaseFirst = resolve;
});
let releasePut;
const putResponse = new Promise((resolve) => {
  releasePut = resolve;
});
function effective(server) {
  const next = clone(server);
  next.items = next.items.filter(
    (item) =>
      !next.exclusions.some(
        (exclusion) =>
          (!exclusion.type || exclusion.type === item.type) &&
          (exclusion.providerId && item.providerId
            ? exclusion.providerId === item.providerId
            : exclusion.name === item.name),
      ),
  );
  return next;
}
function finishGeneration(server, id) {
  server.items = clone([title, series]);
  server.hasBatch = true;
  server.generating = false;
  server.quota.used++;
  server.quota.remaining = 3 - server.quota.used;
  server.generatedAt = new Date().toISOString();
  server.generationId = id;
  completed.add(id);
}
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: process.env.FUTURE_QA_MOBILE
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 },
    locale: "ko-KR",
    timezoneId: "America/Los_Angeles",
    serviceWorkers: "block",
  });
  await context.addInitScript(
    ({ firstUser, scenario, name }) => {
      if (!localStorage.getItem("watchlog.userId")) {
        localStorage.setItem("watchlog.userId", firstUser);
        localStorage.setItem(
          "watchlog.deviceId",
          "40000000-0000-4000-8000-000000000071",
        );
        localStorage.setItem("watchlog.pairingCode", "ISOLATED-FUTURE");
        if (scenario === "legacy")
          localStorage.setItem(
            "watchlog.dismissedRecs",
            JSON.stringify([name]),
          );
      }
      window.__futureOnline = true;
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => window.__futureOnline,
      });
    },
    { firstUser, scenario, name: title.name },
  );
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (!url.pathname.startsWith("/api/"))
      return url.origin === base.origin ? route.continue() : route.abort();
    const method = request.method(),
      owner = request.headers()["x-user-id"] ?? firstUser;
    const data = request.postData() ? request.postDataJSON() : null;
    calls.push({
      method,
      path: url.pathname,
      owner,
      locale: request.headers()["accept-language"],
      data,
    });
    const server = states.get(owner) ?? state;
    const reply = (json, status = 200) => route.fulfill({ status, json });
    if (url.pathname === "/api/recommendations/state") {
      readCount++;
      if (scenario === "scope" && owner === firstUser && readCount === 1)
        await firstRead;
      if (scenario === "concurrent" && server.generating)
        finishGeneration(server, "60000000-0000-4000-8000-000000000071");
      if (scenario === "locale-pending" && server.generating) {
        server.generating = false;
        server.quota.used++;
        server.quota.remaining--;
        // The concurrent success filled another language, so this locale still has no batch.
      }
      return reply(effective(server));
    }
    if (url.pathname === "/api/recommendations/generate") {
      generationAttempts++;
      if (completed.has(data.requestId)) return reply(effective(server));
      if (server.quota.remaining === 0) return reply(effective(server), 429);
      if (scenario === "retry" && generationAttempts === 1)
        return reply({ message: "isolated provider failure" }, 503);
      if (
        ["concurrent", "locale-pending"].includes(scenario) &&
        generationAttempts === 1
      ) {
        server.generating = true;
        return reply(effective(server), 202);
      }
      finishGeneration(server, data.requestId);
      if (scenario === "retry" && generationAttempts === 2)
        return route.abort("failed");
      return reply(effective(server));
    }
    if (
      url.pathname === "/api/recommendations/exclusions" &&
      method === "PUT"
    ) {
      const key = createHash("sha256")
        .update(`${data.type ?? "legacy"}:${data.providerId ?? data.name}`)
        .digest("hex");
      const exclusion = { ...data, key };
      server.exclusions = [
        ...server.exclusions.filter((item) => item.key !== key),
        exclusion,
      ];
      if (scenario === "scope" && owner === secondUser) await putResponse;
      return reply(exclusion);
    }
    if (
      url.pathname.startsWith("/api/recommendations/exclusions/") &&
      method === "DELETE"
    ) {
      server.exclusions = server.exclusions.filter(
        (item) => item.key !== url.pathname.split("/").at(-1),
      );
      return route.fulfill({ status: 204 });
    }
    if (url.pathname === "/api/recommendations/catalog")
      return reply([
        {
          ...editions[0],
          provider: "GOOGLE_BOOKS",
          providerId: "google-edition",
          sourceUrl: "https://books.google.com/books?id=google-edition",
        },
        editions[1],
      ]);
    if (url.pathname === "/api/recommendations")
      return reply(effective(server).items); // red: old UI never reads state.
    if (url.pathname === "/api/auth/profile")
      return reply({ nickname: null, personaKey: "book_drifter" });
    if (url.pathname === "/api/sync/pull")
      return reply({
        serverTime: new Date().toISOString(),
        changes: { titles: [], logs: [] },
      });
    if (url.pathname === "/api/logs/page")
      return reply({ items: [], nextCursor: null });
    if (url.pathname === "/api/sync/push")
      return reply({ message: "Keep the isolated local outbox pending" }, 503);
    if (url.pathname.startsWith("/api/tmdb/"))
      return reply({ genres: [], directors: [], cast: [] });
    return method === "GET" ? reply([]) : route.fulfill({ status: 204 });
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(new URL(`/${locale}/timeline`, base).href, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("button", {
      name: copy("내 미래는?", "What's my future?"),
      exact: true,
    })
    .click();
  const region = page.getByRole("region", {
    name: copy("미래의 타임라인", "Future timeline"),
    exact: true,
  });
  const generate = () =>
    region.getByRole("button", {
      name: copy("다른 이야기 펼쳐보기", "Explore other stories"),
      exact: true,
    });
  const titleButton = (name) =>
    region.getByRole("button", { name, exact: true });
  const ready = async () => {
    await region.waitFor();
    await page.waitForFunction(
      (name) =>
        document
          .querySelector(`section[aria-label="${name}"]`)
          ?.getAttribute("aria-busy") === "false",
      copy("미래의 타임라인", "Future timeline"),
    );
  };
  const focus = async () => {
    const before = readCount;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await poll(() => readCount > before);
    await ready();
  };
  const dismiss = async (name) => {
    await titleButton(name)
      .locator("..")
      .getByRole("button", { name: "이미 본·읽은 작품", exact: true })
      .click();
    await titleButton(name).waitFor({ state: "hidden" });
  };
  const online = async (value) =>
    page.evaluate((value) => {
      window.__futureOnline = value;
      window.dispatchEvent(new Event(value ? "online" : "offline"));
    }, value);
  if (scenario === "scope") {
    await poll(() => readCount === 1);
    await page.evaluate((secondUser) => {
      localStorage.setItem("watchlog.userId", secondUser);
      window.dispatchEvent(new Event("auth:changed"));
    }, secondUser);
    await titleButton("Another account's stories").waitFor();
    releaseFirst();
    await ready();
    assert.equal(await titleButton(title.name).count(), 0);
    await dismiss("Another account's stories");
    await poll(() => calls.some((call) => call.method === "PUT"));
    await page.evaluate((firstUser) => {
      localStorage.setItem("watchlog.userId", firstUser);
      window.dispatchEvent(new Event("auth:changed"));
    }, firstUser);
    releasePut();
    await titleButton(title.name).waitFor();
    await ready();
    assert.equal(
      await region
        .getByRole("button", { name: "되돌리기", exact: true })
        .count(),
      0,
    );
    assert.ok(
      calls
        .filter((call) => call.method === "PUT")
        .every((call) => call.owner === secondUser),
      "Queued writes must never follow a changed auth header into another account",
    );
  } else if (scenario === "retry") {
    await region.getByRole("alert").waitFor();
    assert.equal(state.quota.used, 0);
    await region
      .getByRole("button", { name: "다시 불러오기", exact: true })
      .click();
    await poll(() => generationAttempts === 2);
    await ready();
    await region.getByRole("alert").waitFor();
    await region
      .getByRole("button", { name: "다시 불러오기", exact: true })
      .click();
    await titleButton(title.name).waitFor();
    await ready();
    const ids = calls
      .filter((call) => call.path.endsWith("/generate"))
      .map((call) => call.data.requestId);
    assert.equal(
      new Set(ids).size,
      1,
      "A failed or uncertain generation must reuse its original idempotency key",
    );
    assert.equal(state.quota.used, 1);
  } else if (scenario === "locale-pending") {
    await poll(() => generationAttempts === 1);
    await ready();
    assert.equal(
      await region.getByRole("alert").count(),
      1,
      "A completed batch in another language must not count as a completed current-locale result",
    );
    const pending = await page.evaluate(
      (firstUser) =>
        JSON.parse(
          localStorage.getItem(`watchlog.recommendations.sync.v1:${firstUser}`),
        ),
      firstUser,
    );
    assert.ok(pending.generationRequestIds.ko);
    await focus();
    assert.equal(
      generationAttempts,
      1,
      "Reading state must not repeatedly repost a joined generation",
    );
    await region
      .getByRole("button", { name: "다시 불러오기", exact: true })
      .click();
    await titleButton(title.name).waitFor();
    await ready();
    const ids = calls
      .filter((call) => call.path.endsWith("/generate"))
      .map((call) => call.data.requestId);
    assert.equal(
      new Set(ids).size,
      1,
      "Explicit retry must retain the joined request's UUID",
    );
    assert.equal(state.quota.used, 2);
  } else if (scenario === "empty") {
    await region
      .getByText("아직 펼쳐볼 작품이 없어요. 나중에 다시 만나요.", {
        exact: true,
      })
      .waitFor();
    await focus();
    assert.equal(
      generationAttempts,
      0,
      "An intentionally empty batch must not cause another charged generation",
    );
  } else if (scenario === "legacy") {
    await titleButton(series.name).waitFor();
    await ready();
    assert.equal(await titleButton(title.name).count(), 0);
    assert.equal(calls.filter((call) => call.method === "PUT").length, 1);
    assert.equal(calls.find((call) => call.method === "PUT").data.type, null);
    state.exclusions = [];
    await focus();
    await titleButton(title.name).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", {
        name: copy("내 미래는?", "What's my future?"),
        exact: true,
      })
      .click();
    await titleButton(title.name).waitFor();
    await ready();
    assert.equal(
      calls.filter((call) => call.method === "PUT").length,
      1,
      "Successfully imported legacy choices must not resurrect after an authoritative Undo",
    );
    assert.deepEqual(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("watchlog.dismissedRecs")),
      ),
      [title.name],
    );
  } else {
    await titleButton(
      scenario === "catalog" ? title.name : title.name,
    ).waitFor();
    await ready();
    assert.ok(
      calls.some((call) => call.path === "/api/recommendations/state"),
      "Future timeline must read authoritative quota and exclusions",
    );
    if (scenario === "quota") {
      assert.equal(
        await generate().isDisabled(),
        true,
        "Server quota exhausted elsewhere cannot be bypassed by empty local storage",
      );
      assert.equal(generationAttempts, 0);
      state.quota.used = 1;
      state.quota.remaining = 2;
      await focus();
      assert.equal(await generate().isEnabled(), true);
      await generate().click();
      await poll(() => state.quota.used === 2);
      await ready();
      await generate().click();
      await poll(() => state.quota.used === 3);
      await ready();
      assert.equal(await generate().isDisabled(), true);
      const used = state.quota.used;
      await page.goto(new URL("/en/timeline", base).href, {
        waitUntil: "domcontentloaded",
      });
      await page
        .getByRole("button", { name: "What's my future?", exact: true })
        .click();
      await page
        .getByRole("button", { name: title.name, exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Explore other stories", exact: true })
          .isDisabled(),
        true,
      );
      assert.equal(
        state.quota.used,
        used,
        "Language changes must share the server account quota",
      );
    } else if (scenario === "generation" || scenario === "concurrent") {
      assert.equal(
        state.quota.used,
        1,
        "The first successful generation must count toward the limit of three",
      );
      assert.equal(generationAttempts, 1);
      await focus();
      assert.equal(
        generationAttempts,
        1,
        "Reading an existing batch must be free",
      );
    } else if (scenario === "cross-device") {
      state.exclusions = [{ ...title, key: "external-device-key" }];
      state.quota.used = 3;
      state.quota.remaining = 0;
      await focus();
      await titleButton(title.name).waitFor({ state: "hidden" });
      assert.equal(
        await titleButton(series.name).count(),
        1,
        "The same numeric TMDB ID in another media type must stay visible",
      );
      assert.equal(await generate().isDisabled(), true);
      state.exclusions = [];
      await focus();
      await titleButton(title.name).waitFor();
      assert.equal(generationAttempts, 0);
    } else if (scenario === "pending") {
      await online(false);
      await dismiss(title.name);
      await region
        .getByRole("button", { name: "되돌리기", exact: true })
        .click();
      await titleButton(title.name).waitFor();
      const queued = await page.evaluate(
        (firstUser) =>
          JSON.parse(
            localStorage.getItem(
              `watchlog.recommendations.sync.v1:${firstUser}`,
            ),
          ),
        firstUser,
      );
      assert.deepEqual(
        queued.operations.map((item) => item.kind),
        ["exclude", "restore"],
      );
      assert.equal(calls.filter((call) => call.method === "PUT").length, 0);
      await online(true);
      await poll(() => calls.some((call) => call.method === "DELETE"));
      await ready();
      await titleButton(title.name).waitFor();
      assert.deepEqual(state.exclusions, []);
      assert.equal(state.quota.used, 1);
    } else if (scenario === "catalog") {
      assert.equal((await snapshot(page)).logs.length, 0);
      await region
        .getByRole("button", {
          name: copy("읽고 싶어요", "Want to read"),
          exact: true,
        })
        .click();
      await page
        .getByRole("dialog", {
          name: copy(
            "어떤 판본으로 남겨둘까요?",
            "Which edition would you like to keep?",
          ),
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page
          .getByRole("link", { name: /Google Books/ })
          .getAttribute("href"),
        "https://books.google.com/books?id=google-edition",
      );
      assert.equal(
        await page.locator("button a").count(),
        0,
        "Catalog attribution must stay outside edition selection buttons",
      );
      const firstChoice = await page
        .getByRole("button", { name: /Paperback House/ })
        .boundingBox();
      const secondChoice = await page
        .getByRole("button", { name: /Hardcover House/ })
        .boundingBox();
      assert.ok(
        Math.abs(firstChoice.x - secondChoice.x) <= 1 &&
          secondChoice.y >= firstChoice.y + firstChoice.height,
        "Catalog editions must form a readable vertical list",
      );
      const dialog = await page.getByRole("dialog").boundingBox();
      const close = await page
        .getByRole("button", {
          name: copy("작품 고르기 닫기", "Close title choices"),
          exact: true,
        })
        .boundingBox();
      assert.ok(
        close.x >= dialog.x && close.x + close.width <= dialog.x + dialog.width,
        "The catalog close control must remain inside the dialog",
      );
      assert.equal(
        (await snapshot(page)).logs.length,
        0,
        "Opening catalog choices must not create fake records",
      );
      await page.screenshot({ path: join(output, "catalog.png") });
      await page.getByRole("button", { name: /Hardcover House/ }).click();
      await page.getByTestId("record-status-WISHLIST").waitFor();
      assert.equal(
        await page
          .getByTestId("record-status-WISHLIST")
          .getAttribute("aria-pressed"),
        "true",
        "The intentional recommendation choice preselects the wishlist status",
      );
      assert.equal(
        await page.getByTestId("record-save-initial").isEnabled(),
        true,
      );
      await page.screenshot({ path: join(output, "wishlist-book.png") });
      assert.equal(
        (await snapshot(page)).logs.length,
        0,
        "Confirming an edition still requires an explicit record save",
      );
      await online(false);
      await page.getByTestId("record-status-WISHLIST").click();
      await page.getByTestId("record-save-initial").click();
      await page
        .getByText(copy("타임라인에 남겨두었어요.", "Kept on your timeline."), {
          exact: true,
        })
        .waitFor();
      const saved = await snapshot(page);
      assert.equal(saved.logs.length, 1);
      assert.equal(saved.logs[0].status, "WISHLIST");
      assert.equal(saved.logs[0].title.isbn13, editions[1].isbn13);
      assert.equal(saved.logs[0].title.provider, "KAKAO");
      assert.ok(
        saved.outbox.length > 0,
        "The existing local-first save must queue a real outbox operation while offline",
      );
      await page
        .getByRole("button", {
          name: copy("기록 창 닫기", "Close recording"),
          exact: true,
        })
        .click();
      assert.equal(
        await titleButton(book.name).count(),
        0,
        "A new local wishlist record must disappear immediately without regenerating the batch",
      );
      assert.equal(await titleButton(title.name).count(), 1);
      assert.equal(state.quota.used, 1);
      assert.equal(generationAttempts, 0);
      await region
        .getByRole("button", {
          name: copy("보고 싶어요", "Want to watch"),
          exact: true,
        })
        .click();
      await page.getByTestId("record-status-WISHLIST").waitFor();
      assert.equal((await snapshot(page)).logs.length, 1);
      assert.equal(
        calls.filter((call) => call.path === "/api/recommendations/catalog")
          .length,
        1,
        "A confirmed video snapshot should open the existing record sheet directly",
      );
    }
  }
  assert.deepEqual(errors, []);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: join(output, "screen.png") });
  console.log(
    JSON.stringify({
      result: "PASS",
      scenario,
      generationAttempts,
      calls: calls.filter((call) =>
        call.path.startsWith("/api/recommendations"),
      ),
      errors,
      actualApiWrites: 0,
    }),
  );
} finally {
  releaseFirst();
  releasePut();
  await writeFile(
    join(output, "result.json"),
    JSON.stringify(
      { scenario, generationAttempts, calls, errors, actualApiWrites: 0 },
      null,
      2,
    ),
  );
  await browser.close();
}

async function poll(read, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await read()) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error("Timed out waiting for isolated state");
}
async function snapshot(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("watchlog");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result,
            result = {};
          const tx = database.transaction(["logs", "outbox"], "readonly");
          for (const name of ["logs", "outbox"]) {
            const request = tx.objectStore(name).getAll();
            request.onsuccess = () => {
              result[name] = request.result;
            };
          }
          tx.oncomplete = () => {
            database.close();
            resolve(result);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}
