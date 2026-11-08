/**
 * Actual UI / local development API smoke. Creates a NEW private test account.
 * Uses no API fixtures, existing browser profiles, direct writes, or publication.
 * Run only after the local web server is explicitly ready and points to WSL API:
 *   WEB_RUNTIME_URL=http://127.0.0.1:3173 node scripts/test-v2-real-data.mjs
 * Optional: V2_QA_BOOK=1, V2_QA_SERIES=1, V2_QA_SHARE=1, PLAYWRIGHT_EXECUTABLE_PATH=/path/to/chrome
 * Test records are retained for diagnosis; this script never deletes accounts.
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3173");
assert.ok(
  base.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname),
  "Real-data smoke is restricted to a loopback development web server",
);
const artifacts = path.resolve(
  process.env.V2_QA_ARTIFACTS ?? "/tmp/ottline-v2-web-qa",
);
assert.ok(
  artifacts.startsWith("/tmp/"),
  "QA artifacts must stay outside the repository under /tmp",
);
const stamp = new Date()
  .toISOString()
  .replace(/[^0-9]/g, "")
  .slice(0, 14);
const notes = {
  initial: `UX QA ${stamp} initial`,
  edited: `UX QA ${stamp} edited`,
  offline: `UX QA ${stamp} offline`,
};
const nickname = `UX QA ${stamp}`;
const secrets = new Set();
const checks = [];
const pageErrors = [];
const mutations = [];
const imageChecks = [];
let browser;
let stage = "launch";
let primary;
let secondary;
let secondContext;

function sanitize(value) {
  let text = String(value);
  for (const secret of secrets)
    if (secret) text = text.replaceAll(secret, "[redacted]");
  return text;
}
function passed(name) {
  checks.push(name);
  console.log(`PASS ${name}`);
}
async function poll(label, read, accept, timeout = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await read();
    if (accept(result)) return result;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Timed out: ${label}`);
}
async function newContext(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({
    viewport,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    serviceWorkers: "block",
    acceptDownloads: true,
  });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    // Only third-party analytics is blocked. Every app/API request remains real.
    if (
      /(^|\.)(googletagmanager\.com|google-analytics\.com|clarity\.ms|doubleclick\.net|cloudflareinsights\.com)$/.test(
        url.hostname,
      )
    )
      return route.abort();
    return route.continue();
  });
  context.on("page", (page) => {
    page.setDefaultTimeout(30_000);
    page.setDefaultNavigationTimeout(60_000);
    page.on("pageerror", (error) => pageErrors.push(sanitize(error.message)));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.origin === base.origin &&
        url.pathname.startsWith("/api/") &&
        ["POST", "PATCH", "PUT", "DELETE"].includes(request.method())
      ) {
        // Record endpoint paths only: never retain bodies, pairing codes, or headers.
        mutations.push({ method: request.method(), path: url.pathname });
      }
    });
  });
  return context;
}
async function waitForVisibleImages(page) {
  await page.evaluate(async () => {
    const images = Array.from(document.images).filter((image) => {
      const box = image.getBoundingClientRect();
      return (
        box.width > 0 &&
        box.height > 0 &&
        box.top < innerHeight &&
        box.bottom > 0
      );
    });
    await Promise.all(
      images.map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolve) => {
          const timer = setTimeout(resolve, 30_000);
          const done = () => {
            clearTimeout(timer);
            resolve();
          };
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
        });
      }),
    );
  });
}
async function imageMetrics(locator, label, type) {
  return locator.evaluate(
    (image, context) => {
      const width = image.getBoundingClientRect().width;
      const url = new URL(image.currentSrc);
      return {
        ...context,
        sourceHost: url.hostname,
        sourcePath: url.pathname,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        displayWidth: Math.round(width),
        displayHeight: Math.round(image.getBoundingClientRect().height),
        density: Math.round((image.naturalWidth / width) * 100) / 100,
        objectFit: getComputedStyle(image).objectFit,
        loaded: image.complete && image.naturalWidth > 0,
      };
    },
    { label, type },
  );
}
async function verifyRecordImages(page, records, label) {
  for (const record of records) {
    assert.ok(
      record.title.posterUrl || record.seasonPosterUrl,
      `${record.title.type}: actual provider supplied an image`,
    );
    const row = page.locator(
      `[data-testid="timeline-record"][data-log-id="${record.id}"]`,
    );
    await row.waitFor({ state: "visible", timeout: 60_000 });
    await row.scrollIntoViewIfNeeded();
    const poster = row.locator("img").first();
    await poster.waitFor({ state: "visible" });
    await poll(
      `${record.title.type} actual poster loaded`,
      () =>
        poster.evaluate((image) => image.complete && image.naturalWidth > 0),
      Boolean,
      60_000,
    );
    imageChecks.push(await imageMetrics(poster, label, record.title.type));
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}
async function screenshot(page, name) {
  await waitForVisibleImages(page);
  await page.screenshot({
    path: path.join(artifacts, name),
    fullPage: true,
    mask: [
      page.locator("code"),
      page.locator("#pairing-code"),
      page.locator('[data-private="true"]'),
    ],
    animations: "disabled",
  });
}
async function auth(page) {
  const value = await page.evaluate(() => ({
    user: localStorage.getItem("watchlog.userId"),
    device: localStorage.getItem("watchlog.deviceId"),
    code: localStorage.getItem("watchlog.pairingCode"),
  }));
  for (const item of Object.values(value)) if (item) secrets.add(item);
  return value;
}
async function ownGet(page, endpoint) {
  assert.ok(
    endpoint.startsWith("/logs") || endpoint.startsWith("/auth/"),
    "Only own-account read endpoints are allowed",
  );
  return page.evaluate(async (apiPath) => {
    const userId = localStorage.getItem("watchlog.userId");
    const deviceId = localStorage.getItem("watchlog.deviceId");
    if (!userId || !deviceId) return null;
    const response = await fetch(`/api${apiPath}`, {
      headers: {
        "X-User-Id": userId,
        "X-Device-Id": deviceId,
        "Accept-Language": "ko",
      },
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(`Own-account read failed (${response.status})`);
    return response.json();
  }, endpoint);
}
async function localSnapshot(page) {
  return page.evaluate(async () => {
    const entries = await indexedDB.databases();
    if (!entries.some((entry) => entry.name === "watchlog"))
      return { logs: [], outbox: [], history: [] };
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("watchlog");
      request.onupgradeneeded = () => {
        request.transaction.abort();
        reject(new Error("Read-only QA must not create a database"));
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const names = ["logs", "outbox", "history"];
        const transaction = db.transaction(names, "readonly");
        const result = {};
        for (const name of names) {
          const read = transaction.objectStore(name).getAll();
          read.onsuccess = () => {
            result[name] = read.result;
          };
        }
        transaction.oncomplete = () => {
          db.close();
          resolve(result);
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      };
    });
  });
}
async function serverLog(page, predicate) {
  return poll(
    "new record reaches the real server",
    () => ownGet(page, "/logs?limit=100"),
    (items) => Array.isArray(items) && items.some(predicate),
  ).then((items) => items.find(predicate));
}
async function checkNoOverflow(page, label) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    `${label}: content fits viewport`,
  );
}
async function openRecord(page) {
  const button =
    page.viewportSize().width < 768
      ? page.locator('.app-bottom-nav button[aria-label="기록 남기기"]')
      : page.locator('header button[aria-label="기록 남기기"]');
  await button.click();
  await page.getByTestId("title-search").waitFor({ state: "visible" });
}
async function chooseTitle(page, query, type, provider) {
  const typeLabel =
    type === "movie" ? "영화" : type === "series" ? "시리즈" : "책";
  await page
    .getByRole("dialog")
    .getByRole("button", { name: typeLabel, exact: true })
    .click();
  await page.getByTestId("title-search").fill(query);
  const candidate = page
    .locator(
      `[data-testid="title-search-result"][data-title-type="${type}"][data-title-provider="${provider}"]`,
    )
    .first();
  await candidate.waitFor({ state: "visible", timeout: 60_000 });
  const title = {
    name: await candidate.getAttribute("data-title-name"),
    providerId: await candidate.getAttribute("data-title-id"),
  };
  assert.ok(
    title.name && title.providerId,
    "Search returned a real provider title",
  );
  await candidate.click();
  await page.getByTestId("record-status-DONE").waitFor({ state: "visible" });
  return title;
}
function localDate(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
async function verifyDetails(log, values) {
  assert.equal(log.status, "DONE", "Status survives saving");
  for (const [field, value] of Object.entries(values))
    assert.equal(log[field], value, `${field} survives saving`);
  assert.equal(
    localDate(log.watchedAt),
    "2026-10-31",
    "Calendar date survives UTC storage",
  );
}

await mkdir(artifacts, { recursive: true });
try {
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_EXECUTABLE_PATH ??
      "/home/ergate23/.cache/ms-playwright/chromium-1217/chrome-linux/chrome",
    args: ["--no-sandbox"],
  });
  const context = await newContext();
  primary = await context.newPage();
  stage = "guest boundary";
  const response = await primary.goto(new URL("/account", base).href);
  assert.equal(response.status(), 200, "Actual web account route responds");
  await primary.getByRole("heading", { name: "어디서든, 나의 기록" }).waitFor();
  await primary
    .getByText(
      "첫 기록을 남기거나 기존 기록을 연결한 뒤 내 모습을 고를 수 있어요.",
      { exact: true },
    )
    .waitFor({ timeout: 60_000 });
  assert.ok(
    !Object.values(await auth(primary)).some(Boolean),
    "Fresh guest visit creates no account or pairing code",
  );
  assert.equal(
    await primary.locator('img[src*="storybook"]').count(),
    0,
    "Guest has no invented persona",
  );
  await screenshot(primary, "guest-account-desktop.png");
  passed("guest view has no synthetic identity or account registration");

  stage = "first movie record";
  await openRecord(primary);
  const selected = await chooseTitle(
    primary,
    process.env.V2_QA_MOVIE_QUERY ?? "인셉션",
    "movie",
    "TMDB",
  );
  await primary.getByTestId("record-status-DONE").click();
  await primary.getByTestId("record-save-initial").click();
  await primary.getByTestId("record-edit-details").waitFor();
  await primary.getByTestId("record-edit-details").click();
  await primary.getByTestId("record-date").fill("2026-10-31");
  const platform = await primary
    .getByTestId("record-platform")
    .locator("option")
    .evaluateAll(
      (options) =>
        options.find((option) => /Netflix|넷플릭스/i.test(option.textContent))
          ?.value,
    );
  assert.ok(platform, "Existing Netflix platform preset is available");
  await primary.getByTestId("record-platform").selectOption(platform);
  await primary.getByTestId("record-place").selectOption("HOME");
  await primary.getByTestId("record-occasion").selectOption("ALONE");
  for (const feeling of [5, 3, 1, 5]) {
    const button = primary.getByTestId(`record-feeling-${feeling}`);
    await button.click();
    assert.equal(
      await button.getAttribute("aria-pressed"),
      "true",
      `Feeling ${feeling} is selectable`,
    );
  }
  await primary.getByTestId("record-note").fill(notes.initial);
  for (const checkbox of await primary
    .locator('[role="dialog"] input[type="checkbox"]')
    .all())
    assert.equal(
      await checkbox.isChecked(),
      false,
      "Private record does not opt into publication",
    );
  await primary.getByTestId("record-save-details").click({ timeout: 90_000 });
  await primary.getByTestId("record-done").click();
  const identity = await poll(
    "first action registers own account",
    () => auth(primary),
    (value) => value.user && value.device && value.code,
  );
  const movie = await serverLog(
    primary,
    (log) =>
      log.note === notes.initial &&
      log.title?.provider === "TMDB" &&
      log.title?.providerId === selected.providerId,
  );
  const createdRecords = [movie];
  await verifyDetails(movie, {
    note: notes.initial,
    rating: 5,
    ott: platform,
    place: "HOME",
    occasion: "ALONE",
  });
  await poll(
    "online outbox drained",
    () => localSnapshot(primary),
    (snapshot) => snapshot.outbox.length === 0,
  );
  await primary.reload();
  await primary.goto(new URL("/timeline", base).href);
  await primary
    .locator(`[data-testid="timeline-record"][data-log-id="${movie.id}"]`)
    .waitFor();
  await verifyRecordImages(primary, [movie], "timeline-desktop");
  await screenshot(primary, "timeline-desktop.png");
  passed(
    "TMDB search, first record, date/TPO/platform/three feelings, sync and reload",
  );

  stage = "detail edit and history";
  await primary.goto(new URL(`/title/${movie.title.id}`, base).href);
  await primary.getByTestId("record-detail-edit").click();
  assert.equal(
    await primary.getByTestId("record-date").inputValue(),
    "2026-10-31",
  );
  await primary.getByTestId("record-note").fill(notes.edited);
  await primary.getByTestId("record-feeling-3").click();
  await primary.getByTestId("record-detail-save").click();
  const edited = await serverLog(
    primary,
    (log) => log.id === movie.id && log.note === notes.edited,
  );
  await verifyDetails(edited, {
    note: notes.edited,
    rating: 3,
    ott: platform,
    place: "HOME",
    occasion: "ALONE",
  });
  assert.equal(
    edited.watchedAt,
    movie.watchedAt,
    "Note/feeling edits preserve the unchanged timestamp exactly",
  );
  const history = await poll(
    "server history records the edit",
    () => ownGet(primary, `/logs/${movie.id}/history?limit=50`),
    (entries) =>
      Array.isArray(entries) &&
      entries.some((entry) => entry.note === notes.edited),
  );
  assert.ok(history.length >= 2, "History keeps multiple revisions");
  await primary.reload();
  await primary
    .getByTestId("record-history")
    .getByText(notes.edited, { exact: true })
    .first()
    .waitFor();
  passed("detail update is persisted with history and preserves date/time");

  stage = "offline update and online recovery";
  await primary.getByTestId("record-detail-edit").click();
  await context.setOffline(true);
  await primary.getByTestId("record-note").fill(notes.offline);
  await primary.getByTestId("record-feeling-1").click();
  await primary.getByTestId("record-detail-save").click();
  const offline = await poll(
    "offline edit is safely queued",
    () => localSnapshot(primary),
    (snapshot) =>
      snapshot.logs.some(
        (log) => log.id === movie.id && log.note === notes.offline,
      ) &&
      snapshot.outbox.some(
        (item) => item.logId === movie.id || item.localLogId === movie.id,
      ),
  );
  assert.ok(
    offline.outbox.length > 0,
    "Offline update waits in the actual outbox",
  );
  await screenshot(primary, "detail-offline.png");
  await context.setOffline(false);
  const recovered = await serverLog(
    primary,
    (log) => log.id === movie.id && log.note === notes.offline,
  );
  await verifyDetails(recovered, {
    note: notes.offline,
    rating: 1,
    ott: platform,
    place: "HOME",
    occasion: "ALONE",
  });
  assert.equal(recovered.watchedAt, movie.watchedAt);
  await poll(
    "recovered outbox drained",
    () => localSnapshot(primary),
    (snapshot) => snapshot.outbox.length === 0,
  );
  passed(
    "offline change survives locally and reaches server after reconnecting",
  );

  stage = "profile and recovery card";
  await primary.goto(new URL("/account", base).href);
  await primary
    .getByRole("button", { name: "내 모습 고르기", exact: true })
    .click();
  await primary.locator('input[name="nickname"]').fill(nickname);
  await primary.locator('input[name="persona"][value="book_drifter"]').check();
  await primary
    .getByRole("button", { name: "이 모습으로 저장", exact: true })
    .click();
  await poll(
    "profile persisted",
    () => ownGet(primary, "/auth/profile"),
    (profile) =>
      profile?.nickname === nickname && profile?.personaKey === "book_drifter",
  );
  const recoveryDownload = primary.waitForEvent("download");
  await primary
    .getByRole("button", { name: /복구 카드.*저장|보관 카드.*저장/ })
    .click();
  // The recovery image contains a private code: validate stream length, never save it.
  const recovery = await recoveryDownload;
  const stream = await recovery.createReadStream();
  let recoveryBytes = 0;
  for await (const chunk of stream) recoveryBytes += chunk.length;
  assert.ok(recoveryBytes > 1000, "Actual recovery card is generated");
  await recovery.delete();
  await screenshot(primary, "account-profile-desktop.png");
  passed("real profile save and private recovery card generation");

  stage = "second device pairing";
  secondContext = await newContext({ width: 390, height: 844 });
  secondary = await secondContext.newPage();
  await secondary.goto(new URL("/account", base).href);
  await secondary
    .getByText(
      "첫 기록을 남기거나 기존 기록을 연결한 뒤 내 모습을 고를 수 있어요.",
      { exact: true },
    )
    .waitFor({ timeout: 60_000 });
  assert.ok(
    !Object.values(await auth(secondary)).some(Boolean),
    "Second device starts without any identity",
  );
  await secondary.locator("#pairing-code").fill(identity.code);
  await secondary
    .locator("form")
    .filter({ has: secondary.locator("#pairing-code") })
    .getByRole("button", { name: /연결/ })
    .click();
  const paired = await poll(
    "new device pairs through actual UI",
    () => auth(secondary),
    (value) =>
      value.user === identity.user &&
      value.device &&
      value.device !== identity.device,
  );
  assert.ok(
    paired.user === identity.user,
    "Pairing accesses only the new test account",
  );
  await poll(
    "linked profile arrives",
    () => ownGet(secondary, "/auth/profile"),
    (profile) =>
      profile?.nickname === nickname && profile?.personaKey === "book_drifter",
  );
  const devices = await ownGet(secondary, "/auth/devices");
  assert.equal(
    devices.length,
    2,
    "Actual account reports both newly created devices",
  );
  await secondary
    .getByRole("heading", { name: nickname, exact: true })
    .waitFor();
  await screenshot(secondary, "account-mobile.png");
  await checkNoOverflow(secondary, "mobile account");
  await secondary.locator('.app-bottom-nav a[href$="/timeline"]').click();
  await secondary
    .locator(`[data-testid="timeline-record"][data-log-id="${movie.id}"]`)
    .waitFor({ timeout: 60_000 });
  assert.ok(
    (await ownGet(secondary, "/logs?limit=100")).some(
      (log) => log.id === movie.id && log.note === notes.offline,
    ),
    "Second device sees the synced private record",
  );
  await screenshot(secondary, "timeline-mobile-ko.png");
  passed("fresh second-device pairing restores the actual record and profile");

  stage = "mobile navigation and locale";
  await checkNoOverflow(secondary, "mobile timeline");
  assert.equal(
    await secondary.locator(".app-bottom-nav a").count(),
    4,
    "Four navigation links plus central record action",
  );
  await secondary.locator('header button[lang="en"]').click();
  await secondary.waitForFunction(() => document.documentElement.lang === "en");
  await secondary
    .getByRole("navigation", { name: "Main navigation" })
    .last()
    .getByRole("link", { name: "Timeline", exact: true })
    .waitFor();
  await screenshot(secondary, "timeline-mobile-en.png");
  await checkNoOverflow(secondary, "English mobile timeline");
  await secondary.setViewportSize({ width: 1440, height: 1000 });
  await secondary.locator(".app-top-nav").waitFor({ state: "visible" });
  await screenshot(secondary, "timeline-desktop-en.png");
  await checkNoOverflow(secondary, "English desktop timeline");
  await secondary.locator('header button[lang="ko"]').click();
  await secondary.waitForFunction(() => document.documentElement.lang === "ko");
  await secondary.setViewportSize({ width: 390, height: 844 });
  await secondary.locator('.app-bottom-nav a[href="/"]').click();
  await openRecord(secondary);
  await secondary
    .getByRole("button", { name: "기록 창 닫기", exact: true })
    .click();
  await openRecord(secondary);
  await secondary
    .getByRole("button", { name: "기록 창 닫기", exact: true })
    .click();
  passed(
    "KO/EN desktop/mobile shell, viewport fit and repeated same-home + action",
  );

  if (process.env.V2_QA_BOOK === "1") {
    stage = "optional real Kakao book";
    await openRecord(secondary);
    const book = await chooseTitle(
      secondary,
      process.env.V2_QA_BOOK_QUERY ?? "소년이 온다",
      "book",
      "KAKAO",
    );
    await secondary.getByTestId("record-status-DONE").click();
    await secondary.getByTestId("record-save-initial").click();
    await secondary.getByTestId("record-done").click();
    const savedBook = await serverLog(
      secondary,
      (log) => log.title?.type === "book",
    );
    assert.ok(
      ["KAKAO", "NAVER"].includes(savedBook.title.provider),
      "Kakao search preserves compatible legacy book identity",
    );
    assert.equal(
      savedBook.title.name,
      book.name,
      "Selected book is saved on the server",
    );
    createdRecords.push(savedBook);
    passed("optional Kakao book search and real record");
  }

  if (process.env.V2_QA_SERIES === "1") {
    stage = "optional actual series season and episode";
    await openRecord(secondary);
    const series = await chooseTitle(
      secondary,
      process.env.V2_QA_SERIES_QUERY ?? "오징어 게임",
      "series",
      "TMDB",
    );
    await secondary.getByTestId("record-status-DONE").click();
    await secondary.getByTestId("record-save-initial").click();
    await secondary.getByTestId("record-edit-details").click();
    const season = secondary.getByTestId("record-season");
    const episode = secondary.getByTestId("record-episode");
    const firstSeason = await poll(
      "real TMDB season metadata",
      () =>
        season
          .locator("option")
          .evaluateAll(
            (options) =>
              options.find((option) => Number(option.value) > 0)?.value,
          ),
      Boolean,
    );
    await season.selectOption(firstSeason);
    const firstEpisode = await poll(
      "real TMDB episode metadata",
      () =>
        episode
          .locator("option")
          .evaluateAll(
            (options) =>
              options.find((option) => Number(option.value) > 0)?.value,
          ),
      Boolean,
    );
    await episode.selectOption(firstEpisode);
    await secondary.getByTestId("record-note").fill(`UX QA ${stamp} series`);
    await secondary
      .getByTestId("record-save-details")
      .click({ timeout: 90_000 });
    await secondary.getByTestId("record-done").click();
    const savedSeries = await serverLog(
      secondary,
      (log) =>
        log.title?.providerId === series.providerId &&
        log.title?.type === "series" &&
        log.seasonNumber === Number(firstSeason) &&
        log.episodeNumber === Number(firstEpisode),
    );
    assert.ok(
      savedSeries.seasonPosterUrl,
      "Selected TMDB season poster is retained",
    );
    createdRecords.push(savedSeries);
    await secondary.goto(new URL(`/title/${savedSeries.title.id}`, base).href);
    await secondary.getByTestId("record-detail-edit").click();
    assert.equal(
      await secondary.getByTestId("record-season").inputValue(),
      firstSeason,
      "Detail restores saved season",
    );
    assert.equal(
      await secondary.getByTestId("record-episode").inputValue(),
      firstEpisode,
      "Detail restores saved episode",
    );
    passed(
      "optional real TMDB series metadata, season/episode save and detail restore",
    );
  }

  stage = "actual poster and home image audit";
  await secondary.setViewportSize({ width: 1440, height: 1000 });
  await secondary.goto(new URL("/timeline", base).href);
  await verifyRecordImages(secondary, createdRecords, "timeline-desktop-all");
  await screenshot(secondary, "timeline-actual-posters-desktop.png");
  await secondary.setViewportSize({ width: 390, height: 844 });
  await verifyRecordImages(secondary, createdRecords, "timeline-mobile-all");
  await screenshot(secondary, "timeline-actual-posters-mobile.png");
  await secondary.goto(new URL("/", base).href);
  const featured = secondary.getByTestId("home-featured");
  await featured.waitFor({ state: "visible", timeout: 60_000 });
  const featuredId = await featured.getAttribute("data-log-id");
  assert.ok(
    createdRecords.some((record) => record.id === featuredId),
    "Home features one of this run's actual private records",
  );
  const homePoster = featured.locator("img").first();
  await homePoster.scrollIntoViewIfNeeded();
  await poll(
    "actual home featured poster loaded",
    () =>
      homePoster.evaluate((image) => image.complete && image.naturalWidth > 0),
    Boolean,
    60_000,
  );
  await secondary.evaluate(() => window.scrollTo(0, 0));
  await waitForVisibleImages(secondary);
  imageChecks.push(
    await imageMetrics(
      homePoster,
      "home-mobile-featured",
      createdRecords.find((record) => record.id === featuredId).title.type,
    ),
  );
  await screenshot(secondary, "home-actual-mobile.png");
  await checkNoOverflow(secondary, "actual mobile home");
  await secondary.setViewportSize({ width: 1440, height: 1000 });
  await waitForVisibleImages(secondary);
  imageChecks.push(
    await imageMetrics(
      homePoster,
      "home-desktop-featured",
      createdRecords.find((record) => record.id === featuredId).title.type,
    ),
  );
  await screenshot(secondary, "home-actual-desktop.png");
  await checkNoOverflow(secondary, "actual desktop home");
  await writeFile(
    path.join(artifacts, "actual-image-checks.json"),
    JSON.stringify(imageChecks, null, 2),
  );
  passed(
    "actual provider posters loaded on desktop/mobile and actual home captured",
  );

  if (process.env.V2_QA_SHARE === "1") {
    stage = "optional actual share PNG";
    await primary.goto(new URL(`/title/${movie.title.id}`, base).href);
    await primary
      .getByRole("button", { name: "공유 카드 만들기", exact: true })
      .click();
    const pngDownload = primary.waitForEvent("download", { timeout: 90_000 });
    await primary
      .getByRole("button", { name: /이미지.*저장|이미지.*다운로드/ })
      .click();
    const png = await pngDownload;
    const pngPath = path.join(artifacts, "record-share.png");
    await png.saveAs(pngPath);
    const bytes = await readFile(pngPath);
    assert.ok(
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      "Download is a real PNG",
    );
    passed("optional actual share card PNG");
  }

  assert.equal(
    mutations.filter((item) =>
      /\/comments|\/discussions|\/reactions|\/feedback/.test(item.path),
    ).length,
    0,
    "Smoke never publishes or messages anyone",
  );
  assert.equal(
    mutations.filter((item) => item.method === "DELETE").length,
    0,
    "Smoke never deletes account or record data",
  );
  assert.equal(
    pageErrors.length,
    0,
    `No uncaught browser errors: ${sanitize(pageErrors.join("; "))}`,
  );
  await writeFile(
    path.join(artifacts, "real-data-result.json"),
    JSON.stringify(
      {
        ok: true,
        checks,
        retainedNewPrivateAccount: true,
        screenshotsMasked: true,
        optionalBook: process.env.V2_QA_BOOK === "1",
        optionalSeries: process.env.V2_QA_SERIES === "1",
        optionalShare: process.env.V2_QA_SHARE === "1",
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS ${checks.length} real-data stages; masked artifacts: ${artifacts}`,
  );
} catch (error) {
  for (const [page, name] of [
    [primary, "failure-primary.png"],
    [secondary, "failure-secondary.png"],
  ]) {
    if (page && !page.isClosed()) await screenshot(page, name).catch(() => {});
  }
  const message = sanitize(error?.stack ?? error);
  await writeFile(
    path.join(artifacts, "real-data-result.json"),
    JSON.stringify(
      {
        ok: false,
        stage,
        checks,
        error: message,
        pageErrors: pageErrors.map(sanitize),
        screenshotsMasked: true,
      },
      null,
      2,
    ),
  );
  console.error(`FAIL ${stage}: ${message}`);
  process.exitCode = 1;
} finally {
  if (secondContext) await secondContext.close();
  if (browser) await browser.close();
}
