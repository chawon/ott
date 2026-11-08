/**
 * Rendered QuickLog + real IndexedDB; every API request is intercepted.
 * Uses a new browser context per case and never writes to a real account/public API.
 * WEB_RUNTIME_URL defaults to http://127.0.0.1:4173; loopback is required.
 * Optional: PLAYWRIGHT_EXECUTABLE_PATH and QUICK_LOG_CASE for one named case.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:4173");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
const titleId = "10000000-0000-4000-8000-000000000001";
const dedupLogId = "20000000-0000-4000-8000-000000000001";
const title = {
  id: titleId,
  provider: "TMDB",
  providerId: "27205",
  type: "movie",
  name: "공유 회귀 검증",
  year: 2010,
  genres: ["SF"],
  posterUrl: null,
};
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});

async function poll(label, read, accept, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await read();
    if (accept(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out: ${label}`);
}

async function snapshot(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("watchlog");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const result = {};
          const tx = db.transaction(
            ["logs", "history", "outbox", "titles"],
            "readonly",
          );
          for (const name of ["logs", "history", "outbox", "titles"]) {
            const read = tx.objectStore(name).getAll();
            read.onsuccess = () => {
              result[name] = read.result;
            };
          }
          tx.oncomplete = () => {
            db.close();
            resolve(result);
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
}

async function scenario({
  name,
  deduplicate = false,
  commentFailures = 0,
  pullFailures = 0,
  offline = false,
  initiallyOffline = false,
  slowInitialSync = false,
}) {
  const context = await browser.newContext({
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    serviceWorkers: "block",
  });
  const state = {
    log: null,
    pushes: [],
    rejected: [],
    discussionPosts: [],
    commentPosts: [],
    comments: [],
    failures: commentFailures,
    pullFailures,
    errors: [],
  };
  let releasePush;
  const pushGate = new Promise((resolve) => {
    releasePush = resolve;
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      "watchlog.userId",
      "30000000-0000-4000-8000-000000000001",
    );
    localStorage.setItem(
      "watchlog.deviceId",
      "40000000-0000-4000-8000-000000000001",
    );
    localStorage.setItem("watchlog.pairingCode", "TEST-ONLY-CODE");
  });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/")) {
      return url.origin === base.origin ? route.continue() : route.abort();
    }
    // No /api request, including analytics or unknown endpoints, reaches a server.
    const path = url.pathname.slice(4);
    const body = request.postDataJSON();
    const reply = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (path === "/titles/search")
      return reply(url.searchParams.get("type") === "book" ? [] : [title]);
    if (path === "/titles/popular") return reply([]);
    if (path.startsWith("/tmdb/"))
      return reply({ genres: ["SF"], directors: [], cast: [] });
    if (path === "/sync/push") {
      state.pushes.push(body);
      if (slowInitialSync && state.pushes.length === 1) await pushGate;
      for (const change of body.changes.logs) {
        const create = body.changes.titles.length > 0;
        if (
          !create &&
          change.id !== state.log?.id &&
          change.payload.titleId !== titleId
        ) {
          state.rejected.push({
            id: change.id,
            titleId: change.payload.titleId,
          });
          return reply({ message: "Unknown local title or log ID" }, 400);
        }
        state.log = {
          ...state.log,
          ...change.payload,
          id: state.log?.id ?? (create && deduplicate ? dedupLogId : change.id),
          titleId,
          createdAt: state.log?.createdAt ?? change.updatedAt,
          updatedAt: change.updatedAt,
        };
      }
      return reply({
        accepted: body.changes.logs.map((item) => item.id),
        rejected: [],
      });
    }
    if (path === "/sync/pull") {
      if (state.log?.note && state.pullFailures > 0) {
        state.pullFailures -= 1;
        return reply({ message: "Pull temporarily unavailable" }, 503);
      }
      return reply({
        serverTime: new Date().toISOString(),
        changes: {
          titles: state.log ? [title] : [],
          logs: state.log ? [state.log] : [],
        },
      });
    }
    if (path === "/logs")
      return reply(state.log ? [{ ...state.log, title }] : []);
    if (path === "/discussions" && request.method() === "POST") {
      state.discussionPosts.push(body);
      if (body.titleId !== titleId)
        return reply({ message: "Unknown title" }, 400);
      return reply({ id: "discussion-test", titleId });
    }
    if (
      path === "/discussions/discussion-test/comments" &&
      request.method() === "POST"
    ) {
      state.commentPosts.push(body);
      if (state.failures > 0) {
        state.failures -= 1;
        return reply({ message: "Try later" }, 503);
      }
      const comment = { id: `comment-${state.comments.length + 1}`, ...body };
      state.comments.push(comment);
      return reply(comment);
    }
    if (path.startsWith("/discussions") || path === "/auth/devices")
      return reply([]);
    if (path.startsWith("/titles/")) return reply(title);
    if (path === "/auth/register")
      return reply({
        userId: "30000000-0000-4000-8000-000000000001",
        deviceId: "40000000-0000-4000-8000-000000000001",
        pairingCode: "TEST-ONLY-CODE",
      });
    return reply({});
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => state.errors.push(error.message));
  try {
    await page.goto(`${base.origin}/ko?quick=1`);
    await page.getByTestId("title-search").fill(title.name);
    await page.getByTestId("title-search-result").first().click();
    if (initiallyOffline || slowInitialSync) {
      await page.evaluate(() =>
        Object.defineProperty(navigator, "onLine", {
          configurable: true,
          value: false,
        }),
      );
    }
    await page.getByTestId("record-status-DONE").click();
    await page.getByTestId("record-save-initial").click();
    await poll(
      "initial saved record",
      () => snapshot(page),
      (data) =>
        data.logs.length === 1 &&
        (initiallyOffline || slowInitialSync
          ? data.outbox.length === 1
          : data.logs[0].titleId === titleId && data.outbox.length === 0),
    );
    await page.getByTestId("record-edit-details").click();
    await page.getByTestId("record-note").fill(`Public note ${name}`);
    await page.getByRole("checkbox", { name: "함께 나누기" }).check();
    if (offline)
      await page.evaluate(() =>
        Object.defineProperty(navigator, "onLine", {
          configurable: true,
          value: false,
        }),
      );
    if (slowInitialSync) {
      await page.evaluate(() => {
        delete navigator.onLine;
        window.dispatchEvent(new Event("online"));
      });
      await poll(
        "background create push started",
        () => state.pushes.length,
        (count) => count === 1,
      );
    }
    await page.getByTestId("record-save-details").click();
    if (slowInitialSync) {
      await page.waitForTimeout(150);
      assert.equal(
        state.discussionPosts.length,
        0,
        "Sharing must await the in-flight create and canonical pull",
      );
      assert.equal(
        state.pushes.length,
        1,
        "The edit must wait for the in-flight canonical mapping",
      );
      releasePush();
    }
    if (offline || initiallyOffline || commentFailures || pullFailures) {
      await page.getByTestId("record-retry-sharing").waitFor();
      const before = await snapshot(page);
      const pushesBefore = state.pushes.length;
      const historiesBefore = before.history.length;
      if (pullFailures) {
        assert.equal(
          state.discussionPosts.length,
          0,
          "Sharing must wait for a successful canonical pull",
        );
        assert.equal(before.logs[0].note, `Public note ${name}`);
        assert.equal(
          before.outbox.length,
          0,
          "The private update push already succeeded",
        );
      }
      if (offline || initiallyOffline) {
        assert.equal(state.discussionPosts.length, 0);
        assert.ok(before.outbox.length > 0);
        await page.evaluate(() => {
          delete navigator.onLine;
          window.dispatchEvent(new Event("online"));
        });
      }
      await page.getByTestId("record-retry-sharing").click();
      await poll(
        "retry comment",
        () => state.comments.length,
        (count) => count === 1,
      );
      const after = await snapshot(page);
      assert.equal(
        after.history.length,
        historiesBefore,
        "Sharing retry must not create private history",
      );
      for (const entry of before.history) {
        const retained = after.history.find(
          (candidate) => candidate.id === entry.id,
        );
        assert.ok(
          retained,
          "Canonical remap must retain each existing history ID",
        );
        for (const key of [
          "note",
          "status",
          "rating",
          "watchedAt",
          "place",
          "occasion",
          "recordedAt",
        ]) {
          assert.equal(
            retained[key],
            entry[key],
            `Canonical remap must preserve history ${key}`,
          );
        }
      }
      if (!offline && !initiallyOffline)
        assert.equal(
          state.pushes.length,
          pushesBefore,
          "Sharing retry must not enqueue another update",
        );
    } else {
      await poll(
        "public comment or failure",
        async () => ({
          comments: state.comments.length,
          alert: await page.getByRole("alert").allTextContents(),
        }),
        (value) => value.comments > 0 || value.alert.length > 0,
      );
    }
    if (state.comments.length === 1) {
      await poll(
        "sharing UI settled",
        async () => ({
          retry: await page.getByTestId("record-retry-sharing").isVisible(),
          alerts: await page.getByRole("alert").count(),
        }),
        (value) => !value.retry && value.alerts === 0,
      );
    }
    const data = await snapshot(page);
    const alerts = await page.getByRole("alert").allTextContents();
    console.log(
      JSON.stringify({
        name,
        comments: state.comments.length,
        rejectedUpdates: state.rejected.length,
        staleDiscussionIds: state.discussionPosts.filter(
          (item) => item.titleId !== titleId,
        ).length,
        retryVisible: await page
          .getByTestId("record-retry-sharing")
          .isVisible(),
        alerts,
        logs: data.logs.map((log) => ({
          id: log.id,
          titleId: log.titleId,
          note: log.note,
        })),
        history: data.history.map((entry) => ({
          logId: entry.logId,
          titleId: entry.title?.id,
        })),
        outbox: data.outbox.length,
      }),
    );
    assert.equal(
      state.comments.length,
      1,
      `${name}: sharing must finish with one public comment`,
    );
    assert.equal(state.rejected.length, 0, "Updates must use canonical IDs");
    assert.equal(
      state.discussionPosts.filter((item) => item.titleId !== titleId).length,
      0,
    );
    assert.equal(
      data.logs.length,
      1,
      "Canonical remap must not leave a duplicate private record",
    );
    assert.equal(data.logs[0].id, state.log.id);
    assert.equal(data.logs[0].titleId, titleId);
    assert.equal(data.logs[0].note, `Public note ${name}`);
    assert.equal(data.outbox.length, 0);
    assert.deepEqual(alerts, []);
    assert.equal(
      data.history.length,
      1,
      "One details edit creates one history entry",
    );
    for (const entry of data.history) {
      assert.equal(entry.logId, state.log.id);
      assert.equal(entry.note, `Public note ${name}`);
      assert.equal(entry.status, "DONE");
      assert.equal(entry.watchedAt, data.logs[0].watchedAt);
      if (entry.title) assert.equal(entry.title.id, titleId);
    }
    assert.deepEqual(state.errors, []);
    console.log(`PASS ${name}`);
  } finally {
    releasePush();
    await context.close();
  }
}

try {
  const cases = [
    { name: "canonical-title" },
    { name: "canonical-log-dedup", deduplicate: true },
    { name: "comment-retry", deduplicate: true, commentFailures: 1 },
    { name: "pull-retry", deduplicate: true, pullFailures: 1 },
    { name: "offline-retry", deduplicate: true, offline: true },
    { name: "offline-new-record", deduplicate: true, initiallyOffline: true },
    { name: "slow-background-sync", deduplicate: true, slowInitialSync: true },
  ].filter(
    (item) =>
      !process.env.QUICK_LOG_CASE || item.name === process.env.QUICK_LOG_CASE,
  );
  assert.ok(cases.length > 0, "Unknown QUICK_LOG_CASE");
  for (const item of cases) await scenario(item);
} finally {
  await browser.close();
}
