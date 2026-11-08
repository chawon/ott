// Run: node --experimental-vm-modules --test lib/sync.test.mjs
// Execute the actual sync module with isolated API/storage boundaries.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function harness({ push, pull, auth } = {}) {
  const queue = [];
  const events = [];
  const pullPaths = [];
  const storedLogs = [];
  const online = { onLine: true };
  const storage = new Map([["watchlog.userId", "user"]]);
  const context = createContext({
    navigator: online,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    window: { dispatchEvent: (event) => events.push(event.type) },
    CustomEvent: class {
      constructor(type) {
        this.type = type;
      }
    },
    console: { error: () => {} },
  });
  const api = {
    ensureAuthIds:
      auth ??
      (async () => ({
        userId: storage.get("watchlog.userId"),
        deviceId: "device",
      })),
    apiWithAuth: async (path, options) => {
      if (path === "/sync/push") {
        const log = JSON.parse(options.body).changes.logs[0];
        events.push(`push:${log.id}`);
        const response = push ? await push(log) : undefined;
        if (response) return response;
        return { accepted: [log.id], rejected: [] };
      }
      events.push("pull");
      pullPaths.push(path);
      const response = pull ? await pull(path) : undefined;
      if (response) return response;
      return {
        serverTime: "2026-11-04T00:00:00Z",
        changes: { titles: [], logs: [] },
      };
    },
  };
  const store = {
    listOutbox: async () => structuredClone(queue),
    removeOutboxItem: async (id) => {
      queue.splice(
        queue.findIndex((item) => item.id === id),
        1,
      );
    },
    setLogSyncStatus: async (id, status) => events.push(`${id}:${status}`),
    recordOutboxError: async (id) => events.push(`${id}:error`),
  };
  for (const name of [
    "findTitleByProvider",
    "getTitleLocal",
    "markLogDeleted",
    "remapLogsForTitle",
    "removeLogsByTitleExcept",
    "removeTitleLocal",
    "upsertLogLocal",
    "upsertTitleLocal",
  ])
    store[name] = async () => {};
  store.upsertLogLocal = async (log) => storedLogs.push(log);
  const source = stripTypeScriptTypes(
    await readFile(new URL("./sync.ts", import.meta.url), "utf8"),
  );
  const module = new SourceTextModule(source, { context });
  await module.link(async (name) => {
    const exports = name === "./api" ? api : store;
    return new SyntheticModule(
      Object.keys(exports),
      function () {
        for (const [key, value] of Object.entries(exports))
          this.setExport(key, value);
      },
      { context },
    );
  });
  await module.evaluate();
  return {
    sync: module.namespace.syncOutbox,
    state: module.namespace.getSyncState,
    subscribe: module.namespace.subscribeSyncState,
    idle: module.namespace.IDLE_SYNC_STATE,
    queue,
    events,
    online,
    storage,
    pullPaths,
    storedLogs,
  };
}

function assertState(h, status, failure = null) {
  assert.deepEqual({ ...h.state() }, { status, failure });
  assert.equal(h.state(), h.state(), "unchanged snapshots must be stable");
}
function item(id) {
  return {
    id,
    type: "update_log",
    logId: id,
    payload: {
      log: { id, op: "upsert", payload: { titleId: "canonical-title" } },
    },
  };
}

test("overlapping caller waits for queued edit and its pull; requests never overlap", async () => {
  const firstPush = deferred();
  const firstPushStarted = deferred();
  const lastPull = deferred();
  const lastPullStarted = deferred();
  let pullCount = 0;
  const h = await harness({
    push: async ({ id }) => {
      if (id === "first") {
        firstPushStarted.resolve();
        await firstPush.promise;
      }
    },
    pull: async () => {
      if (++pullCount === 2) {
        lastPullStarted.resolve();
        await lastPull.promise;
      }
    },
  });
  assert.equal(h.state(), h.idle);
  const states = [];
  const unsubscribe = h.subscribe(() => states.push({ ...h.state() }));
  h.queue.push(item("first"));
  const first = h.sync();
  assertState(h, "syncing");
  await firstPushStarted.promise;
  h.queue.push(item("edit"));
  let joinedDone = false;
  const joined = h.sync().then(() => {
    joinedDone = true;
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(
    joinedDone,
    false,
    "joining caller must not finish while the earlier push is active",
  );
  firstPush.resolve();
  await lastPullStarted.promise;
  assertState(h, "syncing");
  assert.equal(
    joinedDone,
    false,
    "joining caller must wait for the edited record canonical pull",
  );
  lastPull.resolve();
  await Promise.all([first, joined]);
  assert.equal(h.state(), h.idle);
  assert.deepEqual(states, [
    { status: "syncing", failure: null },
    { status: "idle", failure: null },
  ]);
  unsubscribe();
  assert.equal(h.queue.length, 0);
  assert.deepEqual(h.events, [
    "push:first",
    "first:synced",
    "sync:updated",
    "pull",
    "sync:updated",
    "push:edit",
    "edit:synced",
    "sync:updated",
    "pull",
    "sync:updated",
  ]);
  h.online.onLine = false;
  await h.sync();
  assertState(h, "offline");
  assert.equal(states.length, 2, "unsubscribed listeners must not be called");
});

test("failed push retains queue, performs pull, and stops immediate requested rerun", async () => {
  const gate = deferred();
  const started = deferred();
  let rejectOnServer = false;
  const h = await harness({
    push: async (log) => {
      if (rejectOnServer) {
        return { accepted: [], rejected: [{ id: log.id, reason: "stale" }] };
      }
      started.resolve();
      await gate.promise;
      throw new Error("API 503: server unavailable");
    },
  });
  h.queue.push(item("first"));
  const first = h.sync();
  await started.promise;
  const joined = h.sync();
  gate.resolve();
  await Promise.all([first, joined]);
  assertState(h, "failed", "request");
  assert.equal(h.queue.length, 1);
  assert.deepEqual(h.events, [
    "push:first",
    "first:error",
    "first:failed",
    "pull",
    "sync:updated",
  ]);
  rejectOnServer = true;
  await h.sync();
  assertState(h, "failed", "rejected");
  assert.equal(h.queue.length, 1);
});

test("offline and auth failures retain work, and later explicit sync can retry", async () => {
  let failAuth = true;
  const h = await harness({
    auth: async () => {
      if (failAuth) throw new Error("auth unavailable");
      return { userId: "user", deviceId: "device" };
    },
  });
  h.queue.push(item("first"));
  h.online.onLine = false;
  await h.sync();
  assertState(h, "offline");
  assert.deepEqual(h.events, []);
  h.online.onLine = true;
  await h.sync();
  assertState(h, "failed", "auth");
  assert.equal(h.queue.length, 1);
  assert.deepEqual(h.events, []);
  failAuth = false;
  await h.sync();
  assert.equal(h.state(), h.idle);
  assert.equal(h.queue.length, 0);
});

test("pull failure rejects joined callers and releases the cycle for a later attempt", async () => {
  const started = deferred();
  const gate = deferred();
  let fail = true;
  const h = await harness({
    pull: async () => {
      if (fail) {
        started.resolve();
        await gate.promise;
        throw new Error("pull failed");
      }
    },
  });
  const first = h.sync();
  await started.promise;
  const joined = h.sync();
  gate.resolve();
  const results = await Promise.allSettled([first, joined]);
  assert.deepEqual(
    results.map((item) => item.status),
    ["rejected", "rejected"],
  );
  assertState(h, "failed", "request");
  fail = false;
  await h.sync();
  assert.equal(h.state(), h.idle);
  assert.equal(h.events.filter((event) => event === "pull").length, 2);
});

for (const previousUser of [null, "previous-user"]) {
  test(`paired account hydrates all records instead of using a ${previousUser ? "different account" : "legacy unowned"} checkpoint`, async () => {
    const h = await harness();
    h.storage.set("watchlog.userId", "paired-user");
    h.storage.set("watchlog.lastSyncAt", "2026-11-07T00:00:00Z");
    if (previousUser) h.storage.set("watchlog.lastSyncUserId", previousUser);

    await h.sync();

    assert.deepEqual(h.pullPaths, ["/sync/pull"]);
    assert.equal(h.storage.get("watchlog.lastSyncUserId"), "paired-user");
    assert.equal(h.storage.get("watchlog.lastSyncAt"), "2026-11-04T00:00:00Z");
    assert.equal(h.state(), h.idle);
  });
}

test("a checkpoint owned by the current account keeps incremental sync", async () => {
  const h = await harness();
  const since = "2026-11-03T12:34:56Z";
  h.storage.set("watchlog.lastSyncAt", since);
  h.storage.set("watchlog.lastSyncUserId", "user");

  await h.sync();

  assert.deepEqual(h.pullPaths, [
    `/sync/pull?since=${encodeURIComponent(since)}`,
  ]);
  assert.equal(h.storage.get("watchlog.lastSyncUserId"), "user");
});

test("an old account pull finishing after pairing cannot cache its records or advance the new account checkpoint", async () => {
  const started = deferred();
  const gate = deferred();
  let pullCount = 0;
  const h = await harness({
    pull: async () => {
      const first = ++pullCount === 1;
      if (first) {
        started.resolve();
        await gate.promise;
      }
      return {
        serverTime: first ? "2026-11-07T00:00:00Z" : "2026-11-07T00:01:00Z",
        changes: {
          titles: [],
          logs: [
            {
              id: first ? "old-account-log" : "paired-account-log",
              titleId: "title",
              status: "DONE",
            },
          ],
        },
      };
    },
  });
  const since = "2026-11-03T12:34:56Z";
  h.storage.set("watchlog.lastSyncAt", since);
  h.storage.set("watchlog.lastSyncUserId", "user");
  const first = h.sync();
  await started.promise;
  h.storage.set("watchlog.userId", "paired-user");
  const joined = h.sync();
  gate.resolve();
  await Promise.all([first, joined]);

  assert.deepEqual(h.pullPaths, [
    `/sync/pull?since=${encodeURIComponent(since)}`,
    "/sync/pull",
  ]);
  assert.deepEqual(
    h.storedLogs.map((log) => log.id),
    ["paired-account-log"],
  );
  assert.equal(h.storage.get("watchlog.lastSyncUserId"), "paired-user");
  assert.equal(h.storage.get("watchlog.lastSyncAt"), "2026-11-07T00:01:00Z");
});
