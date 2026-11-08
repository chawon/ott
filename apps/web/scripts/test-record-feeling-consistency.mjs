/** Compare the actual chosen feeling icon with Home and Timeline.
 * Every API response is isolated; no real account or record writes.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3000");
assert.ok(
  base.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(base.hostname),
);
const locale = process.env.FEELING_QA_LOCALE ?? "ko";
const type = process.env.FEELING_QA_TYPE ?? "movie";
const rating = Number(process.env.FEELING_QA_RATING ?? 3);
const width = Number(process.env.FEELING_QA_WIDTH ?? 1440);
const output =
  process.env.FEELING_QA_OUTPUT ??
  join(tmpdir(), "ottline-feeling-consistency");
await mkdir(output, { recursive: true });
const title = {
  id: "10000000-0000-4000-8000-000000000031",
  type,
  name: process.env.FEELING_QA_TITLE ?? "기억에 남은 이야기",
  provider: type === "book" ? "KAKAO" : "TMDB",
  providerId: "isolated-feeling",
  year: 2021,
  posterUrl: "/feeling-fixture/poster.svg",
  directors:
    process.env.FEELING_QA_LONG_META === "1"
      ? ["긴 이름을 가진 감독과 함께 기억해 두고 싶은 여러 사람의 이야기"]
      : undefined,
};
const log = {
  id: "20000000-0000-4000-8000-000000000031",
  titleId: title.id,
  title,
  status: "DONE",
  rating,
  note: Array.from(
    { length: 20 },
    (_, i) =>
      `${i + 1}. 이야기가 끝나고 나서도 그날의 장면과 마음이 오래 남았어요.`,
  ).join("\n"),
  watchedAt: "2026-11-07T00:00:00Z",
  createdAt: "2026-11-07T00:00:00Z",
  updatedAt: "2026-11-07T00:00:00Z",
  origin: "LOG",
  spoiler: false,
  place: "HOME",
  occasion: "ALONE",
  ott:
    process.env.FEELING_QA_LONG_META === "1"
      ? "작은 영화관에서 함께 나눈 특별한 상영과 오래 기억할 플랫폼 이름"
      : null,
  syncStatus: "synced",
};
if (process.env.FEELING_QA_NOTE === "short")
  log.note = "조용히 오래 남은 이야기예요.";
if (process.env.FEELING_QA_NOTE === "none") log.note = "";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
let page;
try {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    locale: locale === "ko" ? "ko-KR" : "en-US",
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      "watchlog.userId",
      "30000000-0000-4000-8000-000000000031",
    );
    localStorage.setItem(
      "watchlog.deviceId",
      "40000000-0000-4000-8000-000000000031",
    );
    localStorage.setItem("watchlog.pairingCode", "ISOLATED-FEELING");
  });
  await context.route("**/feeling-fixture/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="#ddd"/></svg>',
    }),
  );
  await context.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET")
      return route.fulfill({ status: 204 });
    if (url.pathname === `/api/titles/${title.id}`)
      return route.fulfill({ json: title });
    if (url.pathname === "/api/logs") return route.fulfill({ json: [log] });
    if (url.pathname === "/api/logs/page")
      return route.fulfill({ json: { items: [log], nextCursor: null } });
    if (url.pathname === "/api/auth/profile")
      return route.fulfill({
        json: { nickname: null, personaKey: "cinema_keeper" },
      });
    if (url.pathname === "/api/sync/pull")
      return route.fulfill({
        json: {
          serverTime: new Date().toISOString(),
          changes: { titles: [title], logs: [log] },
        },
      });
    return route.fulfill({ json: [] });
  });
  page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on("pageerror", (error) => errors.push(error.message));
  const icon = async (scope) =>
    (await scope.locator("svg").getAttribute("class"))
      .split(/\s+/)
      .find((name) => name.startsWith("lucide-") && name !== "lucide-icon");
  await page.goto(`${base.origin}/${locale}/title/${title.id}`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByTestId("record-detail-edit").click();
  const selected = page.locator(
    'button[data-testid^="record-feeling-"][aria-pressed="true"]',
  );
  const selectedIcon = await icon(selected);
  const selectedLabel = await selected.innerText();
  await page.goto(`${base.origin}/${locale}`, {
    waitUntil: "domcontentloaded",
  });
  const featured = page.getByTestId("home-featured");
  await featured.waitFor();
  const homeFeeling = featured.locator('span[class*="feeling"]');
  const homeIcon = await icon(homeFeeling);
  const homeLabel = await homeFeeling.innerText();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  const memo = await featured.evaluate((card) => {
    const note = card.querySelector('blockquote[class*="featuredNote"]');
    if (!note) return null;
    const content = window.matchMedia("(min-width: 768px)").matches
      ? (note.querySelector('span[class*="featuredNoteText"]') ?? note)
      : note;
    const poster = card.querySelector('div[class*="poster"]');
    const actions = card.querySelector('div[class*="featuredActions"]');
    const css = getComputedStyle(content);
    const rect = content.getBoundingClientRect(),
      posterRect = poster.getBoundingClientRect();
    return {
      visibleHeight: rect.height,
      lineHeight: parseFloat(css.lineHeight),
      scrollHeight: content.scrollHeight,
      viewportHeight: note.getBoundingClientRect().height,
      clamp: css.webkitLineClamp,
      posterHeight: posterRect.height,
      posterBottom: posterRect.bottom,
      noteBottom: rect.bottom,
      actionsBottom: actions.getBoundingClientRect().bottom,
      textPreserved: note.textContent.length,
    };
  });
  await page.screenshot({ path: join(output, "home.png") });
  await page.goto(`${base.origin}/${locale}/timeline`, {
    waitUntil: "domcontentloaded",
  });
  const row = page
    .getByTestId("timeline-record")
    .filter({ hasText: title.name });
  await row.waitFor();
  const timelineFeeling = row.locator('span[class*="feeling"]');
  const timelineIcon = await icon(timelineFeeling);
  const timelineLabel = await timelineFeeling.innerText();
  const result = {
    locale,
    width,
    type,
    rating,
    selectedIcon,
    homeIcon,
    timelineIcon,
    selectedLabel,
    homeLabel,
    timelineLabel,
    memo,
    errors,
    actualApiWrites: 0,
  };
  await writeFile(join(output, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  assert.equal(
    homeIcon,
    selectedIcon,
    "Home must use the same icon as the selected feeling",
  );
  assert.equal(
    timelineIcon,
    selectedIcon,
    "Timeline must use the same icon as the selected feeling",
  );
  assert.equal(homeLabel, selectedLabel);
  assert.equal(timelineLabel, selectedLabel);
  assert.deepEqual(errors, []);
  await context.close();
} catch (error) {
  console.error(
    JSON.stringify({
      result: "FAIL",
      message: error.message,
      errors,
      url: page?.url(),
    }),
  );
  throw error;
} finally {
  await browser.close();
}
