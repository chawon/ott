// Run: node --experimental-vm-modules --test lib/sync.test.mjs
// Execute the actual sync module with isolated API/storage boundaries.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import Dexie from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function harness({
  push,
  pull,
  auth,
  pairing,
  indexedDB = new IDBFactory(),
} = {}) {
  const events = [];
  const requests = [];
  const pullPaths = [];
  const online = { onLine: true };
  const storage = new Map([
    ["watchlog.userId", "user"],
    ["watchlog.deviceId", "device"],
    ["watchlog.pairingCode", "PAIRCODE"],
  ]);
  const defaultPull = {
    serverTime: "2026-11-04T00:00:00Z",
    changes: { titles: [], logs: [] },
  };
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  const context = createContext({
    navigator: online,
    localStorage,
    Headers,
    FormData,
    Error,
    window: {
      location: { hostname: "localhost", reload: () => events.push("reload") },
      dispatchEvent: (event) => events.push(event.type),
    },
    CustomEvent,
    console,
    Promise,
    fetch: async (url, init) => {
      const path = url.slice("/api".length);
      if (path === "/auth/pair" && pairing) {
        const result = await pairing(JSON.parse(init.body));
        return result instanceof Response ? result : Response.json(result);
      }
      const user = init.headers.get("X-User-Id");
      const device = init.headers.get("X-Device-Id");
      let result;
      if (path === "/sync/push") {
        const log = JSON.parse(init.body).changes.logs[0];
        events.push(`push:${log.id}`);
        requests.push({ path, user, device, log });
        result = (await push?.(log)) ?? { accepted: [log.id], rejected: [] };
      } else {
        events.push("pull");
        requests.push({ path, user, device });
        pullPaths.push(path);
        result = (await pull?.(path)) ?? defaultPull;
      }
      return result instanceof Response ? result : Response.json(result);
    },
  });
  // Exercise production Dexie transactions, IndexedDB serialization and the
  // actual authenticated HTTP error handling against an isolated in-memory DB.
  class TestDatabase extends Dexie {
    constructor(name) {
      super(name, { indexedDB, IDBKeyRange });
    }
  }
  const mocks = {
    dexie: { default: TestDatabase },
    ...(auth ? { "./auth": { ensureAuth: auth } } : {}),
    "./analytics": { trackEvent: async () => {} },
    "./utils": { safeUUID: () => crypto.randomUUID() },
  };
  const modules = new Map();
  async function load(name) {
    if (!modules.has(name)) {
      modules.set(
        name,
        (async () => {
          if (Object.hasOwn(mocks, name)) {
            const exports = mocks[name];
            return new SyntheticModule(
              Object.keys(exports),
              function () {
                for (const [key, value] of Object.entries(exports))
                  this.setExport(key, value);
              },
              { context },
            );
          }
          const file = name.endsWith(".mjs") ? name : `${name}.ts`;
          const source = await readFile(new URL(file, import.meta.url), "utf8");
          return new SourceTextModule(
            stripTypeScriptTypes(source, { mode: "transform" }),
            { context },
          );
        })(),
      );
    }
    return modules.get(name);
  }
  const module = await load("./sync");
  await module.link(load);
  await module.evaluate();
  const { db } = (await load("./db")).namespace;
  const store = (await load("./localStore")).namespace;
  return {
    sync: module.namespace.syncOutbox,
    state: module.namespace.getSyncState,
    subscribe: module.namespace.subscribeSyncState,
    idle: module.namespace.IDLE_SYNC_STATE,
    enqueue: (...items) => db.outbox.bulkPut(items),
    queue: () => store.listOutbox(),
    pair: (await load("./auth")).namespace.pairWithCode,
    db,
    store,
    events,
    requests,
    online,
    storage,
    pullPaths,
  };
}

function assertState(h, status, failure = null) {
  assert.deepEqual({ ...h.state() }, { status, failure });
  assert.equal(h.state(), h.state(), "unchanged snapshots must be stable");
}
let sequence = 0;
function item(id) {
  return {
    id,
    type: "update_log",
    logId: id,
    createdAt: new Date(Date.UTC(2026, 10, 1) + sequence++).toISOString(),
    attempts: 0,
    payload: {
      log: {
        id,
        op: "upsert",
        updatedAt: "2026-11-03T18:00:00.000Z",
        payload: { titleId: "canonical-title" },
      },
    },
  };
}

test("a confirmed newer server log settles only its stale operation and unblocks the next push", async () => {
  const h = await harness({
    push: async (log) =>
      log.id === "first"
        ? { accepted: [], rejected: [{ id: log.id, reason: "stale" }] }
        : undefined,
    pull: async () => ({
      serverTime: "2026-11-04T01:00:00Z",
      changes: {
        titles: [],
        logs: [
          {
            createdAt: "2026-11-01T00:00:00Z",
            watchedAt: "2026-11-01T00:00:00Z",
            id: "first",
            titleId: "canonical-title",
            updatedAt: "2026-11-03T23:00:00.000Z",
            status: "DONE",
            note: "edited on another device",
          },
        ],
      },
    }),
  });
  await h.enqueue(item("first"), item("next"));
  await h.sync();
  assert.deepEqual(await h.queue(), []);
  assert.ok(h.events.includes("push:next"));
  assert.equal((await h.db.logs.get("first")).note, "edited on another device");
  assert.equal(h.state(), h.idle);
});

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
  await h.enqueue(item("first"));
  const first = h.sync();
  assertState(h, "syncing");
  await firstPushStarted.promise;
  await h.enqueue(item("edit"));
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
  assert.equal((await h.queue()).length, 0);
  assert.deepEqual(h.events, [
    "push:first",
    "sync:updated",
    "pull",
    "sync:updated",
    "push:edit",
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
  await h.enqueue(item("first"));
  const first = h.sync();
  await started.promise;
  const joined = h.sync();
  gate.resolve();
  await Promise.all([first, joined]);
  assertState(h, "failed", "request");
  assert.equal((await h.queue()).length, 1);
  assert.deepEqual(h.events, ["push:first", "pull", "sync:updated"]);
  rejectOnServer = true;
  await h.sync();
  assertState(h, "failed", "rejected");
  assert.equal((await h.queue()).length, 1);
});

test("offline and auth failures retain work, and later explicit sync can retry", async () => {
  let failAuth = true;
  const h = await harness({
    auth: async () => {
      if (failAuth) throw new Error("auth unavailable");
      return { userId: "user", deviceId: "device" };
    },
  });
  await h.enqueue(item("first"));
  h.online.onLine = false;
  await h.sync();
  assertState(h, "offline");
  assert.deepEqual(h.events, []);
  h.online.onLine = true;
  await h.sync();
  assertState(h, "failed", "auth");
  assert.equal((await h.queue()).length, 1);
  assert.deepEqual(h.events, []);
  failAuth = false;
  await h.sync();
  assert.equal(h.state(), h.idle);
  assert.equal((await h.queue()).length, 0);
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
  assert.deepEqual(await h.db.logs.toCollection().primaryKeys(), [
    "paired-account-log",
  ]);
  assert.equal(h.storage.get("watchlog.lastSyncUserId"), "paired-user");
  assert.equal(h.storage.get("watchlog.lastSyncAt"), "2026-11-07T00:01:00Z");
});

const sentAt = "2026-11-03T18:00:00.000Z";
const serverAt = "2026-11-03T18:00:00.000456Z";
const title = { id: "canonical-title", name: "Fixture", type: "movie" };
function operation(type, id, recordId = "record", note = "local draft") {
  const row = { ...item(recordId), id, type };
  if (type === "create_log") {
    delete row.logId;
    row.localLogId = recordId;
  }
  row.payload.log.payload = { titleId: title.id, status: "DONE", note };
  return row;
}
function serverRow(overrides = {}) {
  return {
    id: "record",
    titleId: title.id,
    status: "DONE",
    note: "server revision",
    watchedAt: sentAt,
    createdAt: sentAt,
    updatedAt: serverAt,
    ...overrides,
  };
}
function serverPull(logs, titles = [title]) {
  return { serverTime: "2026-11-04T00:00:00Z", changes: { logs, titles } };
}
function stale(log) {
  return { accepted: [], rejected: [{ id: log.id, reason: "stale" }] };
}
function history(id, note = "local draft") {
  return { id, logId: "record", recordedAt: sentAt, status: "DONE", note };
}
async function seed(h, row = operation("update_log", "operation")) {
  const local = {
    ...serverRow(),
    title,
    note: "local draft",
    updatedAt: sentAt,
    syncStatus: "pending",
  };
  await h.store.upsertLogLocal(local);
  await h.store.upsertHistoryLocal([history("existing-history")]);
  await h.enqueue(row);
  return local;
}

test("recovery reads from the rejected change version and accepts sub-millisecond server proof before later create and update", async () => {
  const h = await harness({
    push: async (log) => (log.id === "record" ? stale(log) : undefined),
    pull: async (path) =>
      path.endsWith(encodeURIComponent(sentAt))
        ? serverPull([
            serverRow({ updatedAt: "2026-11-04T03:00:00.000456+09:00" }),
          ])
        : serverPull([]),
  });
  h.storage.set("watchlog.lastSyncUserId", "user");
  h.storage.set("watchlog.lastSyncAt", "2026-11-04T00:00:00Z");
  await seed(h);
  await h.enqueue(
    operation("create_log", "create", "next"),
    operation("update_log", "update", "next", "edited"),
  );
  await h.sync();
  assert.deepEqual(
    h.requests.map((req) => req.log?.id ?? req.path),
    [
      "record",
      `/sync/pull?since=${encodeURIComponent(sentAt)}`,
      "next",
      "next",
      "/sync/pull?since=2026-11-04T00%3A00%3A00Z",
    ],
  );
  assert.deepEqual(await h.queue(), []);
  assert.equal((await h.db.logs.get("record")).note, "server revision");
  assert.equal(
    (await h.db.history.get("existing-history")).note,
    "local draft",
  );
});

for (const [name, rows] of [
  ["empty response", []],
  [
    "another canonical record with the same title",
    [serverRow({ id: "different-canonical" })],
  ],
  ["missing version", [serverRow({ updatedAt: undefined })]],
  ["older version", [serverRow({ updatedAt: "2026-11-03T17:59:59.999999Z" })]],
  [
    "the same instant with a different offset",
    [serverRow({ updatedAt: "2026-11-04T03:00:00.000000+09:00" })],
  ],
  ["an incomplete server record", [serverRow({ titleId: undefined })]],
]) {
  test(`stale with ${name} preserves the draft, history and operation while unrelated work proceeds`, async () => {
    const h = await harness({
      push: async (log) => (log.id === "record" ? stale(log) : undefined),
      pull: async () => serverPull(rows),
    });
    await seed(h, operation("create_log", "temp-create"));
    await h.enqueue(
      operation("update_log", "later-same", "record"),
      operation("create_log", "later-other", "other"),
    );
    await h.sync();
    assertState(h, "failed", "rejected");
    assert.deepEqual(
      (await h.queue()).map((row) => row.id),
      ["temp-create", "later-same"],
    );
    assert.deepEqual(
      h.requests.filter((r) => r.log).map((r) => r.log.id),
      ["record", "other"],
    );
    assert.equal((await h.db.logs.get("record")).note, "local draft");
    assert.equal((await h.db.history.get("existing-history")).logId, "record");
  });
}

for (const stage of ["push", "recovery"]) {
  for (const failure of ["401", "503", "network", "offline"]) {
    test(`${stage} ${failure} preserves the account, indexed records, history and retryable operation`, async () => {
      let failed = true;
      function response() {
        if (failure === "offline") h.online.onLine = false;
        if (failure === "offline" || failure === "network")
          throw new TypeError("Failed to fetch");
        return Response.json(
          { message: "fixture failure" },
          { status: Number(failure) },
        );
      }
      const h = await harness({
        push: async (log) =>
          failed && stage === "push" ? response() : stale(log),
        pull: async () =>
          failed && stage === "recovery"
            ? response()
            : serverPull([serverRow()]),
      });
      await seed(h);
      await h.sync();
      assertState(
        h,
        failure === "offline" ? "offline" : "failed",
        failure === "offline" ? null : "request",
      );
      assert.equal((await h.queue())[0].id, "operation");
      assert.equal((await h.db.logs.get("record")).note, "local draft");
      assert.equal(
        (await h.db.history.get("existing-history")).note,
        "local draft",
      );
      assert.equal(h.storage.get("watchlog.userId"), "user");
      assert.equal(h.storage.get("watchlog.deviceId"), "device");
      assert.equal(h.events.includes("auth:revoked"), false);
      assert.equal(h.events.includes("reload"), false);
      failed = false;
      h.online.onLine = true;
      await h.sync();
      assert.equal((await h.queue()).length, 0);
      assert.equal((await h.db.logs.get("record")).note, "server revision");
      assert.equal(h.state(), h.idle);
    });
  }
}

for (const originalType of ["create_log", "update_log"]) {
  test(`a new edit during conflict recovery of ${originalType} survives clock skew and interruption, including its history`, async () => {
    const started = deferred(),
      release = deferred();
    let firstRead = true,
      interrupt = true;
    const h = await harness({
      push: async (log) =>
        log.payload.note === "local draft"
          ? stale(log)
          : interrupt
            ? Response.json({}, { status: 401 })
            : undefined,
      pull: async () => {
        if (firstRead) {
          firstRead = false;
          started.resolve();
          await release.promise;
        }
        return serverPull([serverRow()]);
      },
    });
    const draft = await seed(h, operation(originalType, "sent"));
    const running = h.sync();
    await started.promise;
    const change = {
      id: "record",
      op: "upsert",
      updatedAt: sentAt,
      payload: { titleId: title.id, status: "DONE", note: "just edited" },
    };
    await h.store.saveLogEdit(
      { ...draft, note: "just edited" },
      change,
      history("new-history", "just edited"),
    );
    release.resolve();
    await running;
    assertState(h, "failed", "request");
    const [remaining] = await h.queue();
    assert.equal((await h.queue()).length, 1);
    assert.equal(remaining.id === "sent", originalType === "create_log");
    assert.equal(remaining.payload.log.payload.note, "just edited");
    assert.ok(
      Date.parse(remaining.payload.log.updatedAt) > Date.parse(serverAt),
    );
    assert.equal((await h.db.logs.get("record")).note, "just edited");
    assert.equal(
      (await h.db.history.get("existing-history")).note,
      "local draft",
    );
    assert.equal((await h.db.history.get("new-history")).note, "just edited");
    assert.equal(
      h.requests.filter((r) => r.log?.payload.note === "local draft").length,
      1,
    );
    interrupt = false;
    await h.sync();
    assert.equal((await h.queue()).length, 0);
    assert.equal((await h.db.logs.get("record")).note, "just edited");
  });
}

for (const stage of ["push", "recovery"]) {
  test(`a different account taking over during ${stage} cannot replay or acknowledge the old work`, async () => {
    const started = deferred(),
      release = deferred();
    let first = true;
    async function waitOnce() {
      if (first) {
        first = false;
        started.resolve();
        await release.promise;
      }
    }
    const h = await harness({
      push: async (log) => {
        if (stage === "push") await waitOnce();
        return stale(log);
      },
      pull: async () => {
        if (stage === "recovery") await waitOnce();
        return serverPull([serverRow()]);
      },
    });
    await seed(h);
    const running = h.sync();
    await started.promise;
    h.storage.set("watchlog.userId", "different");
    h.storage.set("watchlog.deviceId", "different-device");
    release.resolve();
    await running;
    await h.sync();
    assert.deepEqual(
      h.requests.filter((r) => r.log).map((r) => r.user),
      ["user"],
    );
    assert.deepEqual(
      (await h.queue()).map((r) => [r.id, r.userId]),
      [["operation", "user"]],
    );
    assert.equal((await h.db.logs.get("record")).note, "local draft");
    assert.equal(
      (await h.db.history.get("existing-history")).note,
      "local draft",
    );
    assert.equal(
      h.requests.some(
        (r) => r.user === "different" && r.device === "different-device",
      ),
      true,
    );
  });
}

test("only a successful explicit account merge resumes the known source outbox in the paired account", async () => {
  let fail = true;
  const h = await harness({
    pairing: async ({ oldUserId }) => {
      assert.equal(oldUserId, "user");
      return fail
        ? Response.json({}, { status: 401 })
        : { userId: "paired", deviceId: "paired-device", pairingCode: "PAIR2" };
    },
  });
  h.storage.set("watchlog.lastSyncUserId", "user");
  await h.enqueue({ ...item("known"), userId: "user" }, item("legacy"), {
    ...item("other"),
    userId: "someone-else",
  });
  await assert.rejects(h.pair("PAIR2"));
  assert.deepEqual(
    (await h.queue()).map((r) => r.userId),
    ["user", undefined, "someone-else"],
  );
  fail = false;
  await h.pair("PAIR2");
  assert.deepEqual(
    (await h.queue()).map((r) => r.userId),
    ["paired", "paired", "someone-else"],
  );
  await h.sync();
  assert.deepEqual(
    h.requests.filter((r) => r.log).map((r) => [r.user, r.log.id]),
    [
      ["paired", "known"],
      ["paired", "legacy"],
    ],
  );
  assert.deepEqual(
    (await h.queue()).map((r) => r.id),
    ["other"],
  );
});

test("an unowned legacy operation with a different known checkpoint owner stays with that account", async () => {
  const h = await harness();
  h.storage.set("watchlog.lastSyncUserId", "previous");
  await h.enqueue(item("legacy"), { ...item("current"), userId: "user" });
  await h.sync();
  assert.deepEqual(
    h.requests.filter((r) => r.log).map((r) => r.log.id),
    ["current"],
  );
  assert.deepEqual(
    (await h.queue()).map((r) => [r.id, r.userId]),
    [["legacy", "previous"]],
  );
});

test("a successful but superseded pairing response cannot transfer messages or replace the active identity", async () => {
  const started = deferred(),
    release = deferred();
  const h = await harness({
    pairing: async () => {
      started.resolve();
      await release.promise;
      return {
        userId: "paired",
        deviceId: "paired-device",
        pairingCode: "PAIR2",
      };
    },
  });
  await h.enqueue({ ...item("source-operation"), userId: "user" });
  const running = h.pair("PAIR2");
  await started.promise;
  h.storage.set("watchlog.userId", "other");
  h.storage.set("watchlog.deviceId", "other-device");
  release.resolve();
  await assert.rejects(running, /active account changed/);
  assert.equal(h.storage.get("watchlog.userId"), "other");
  assert.equal((await h.queue())[0].userId, "user");
});

test("a second pairing during the IndexedDB transfer rolls the transfer back and keeps the latest session", async () => {
  const h = await harness({
    pairing: async () => ({
      userId: "paired",
      deviceId: "paired-device",
      pairingCode: "PAIR2",
    }),
  });
  await h.enqueue({ ...item("source"), userId: "user" });
  h.db.outbox.hook("updating", () => {
    h.storage.set("watchlog.userId", "newer-session");
    h.storage.set("watchlog.deviceId", "newer-device");
  });
  await assert.rejects(h.pair("PAIR2"), /active account changed/);
  assert.equal(h.storage.get("watchlog.userId"), "newer-session");
  assert.equal(h.storage.get("watchlog.deviceId"), "newer-device");
  assert.equal((await h.queue())[0].userId, "user");
});

test("a second tab can save and retry a same-key edit while the first tab's stale read is suspended", async () => {
  const indexedDB = new IDBFactory();
  const started = deferred(),
    release = deferred();
  const first = await harness({
    indexedDB,
    push: stale,
    pull: async () => {
      started.resolve();
      await release.promise;
      return serverPull([serverRow()]);
    },
  });
  const second = await harness({
    indexedDB,
    push: async (log) =>
      Date.parse(log.updatedAt) <= Date.parse(serverAt)
        ? stale(log)
        : undefined,
    pull: async () => serverPull([serverRow()]),
  });
  const local = await seed(first, operation("create_log", "same-row"));
  const waiting = first.sync();
  await started.promise;
  await second.store.saveLogEdit(
    { ...local, note: "second tab" },
    {
      id: "record",
      op: "upsert",
      updatedAt: sentAt,
      payload: { titleId: title.id, status: "DONE", note: "second tab" },
    },
    history("second-tab-history", "second tab"),
  );
  await second.store.upsertLogsLocal([{ ...serverRow(), title }]);
  assert.equal((await second.db.logs.get("record")).note, "second tab");
  await second.sync();
  release.resolve();
  await waiting;
  assert.deepEqual(await first.queue(), []);
  assert.equal((await first.db.logs.get("record")).note, "second tab");
  assert.equal(
    (await first.db.history.get("second-tab-history")).note,
    "second tab",
  );
  const sent = second.requests.filter((r) => r.log).map((r) => r.log);
  assert.equal(sent.length, 2);
  assert.ok(Date.parse(sent[1].updatedAt) > Date.parse(serverAt));
});

test("an independent save joined during an unverified stale read is sent before the caller returns", async () => {
  const started = deferred(),
    release = deferred();
  const h = await harness({
    push: async (log) => (log.id === "record" ? stale(log) : undefined),
    pull: async () => {
      started.resolve();
      await release.promise;
      return serverPull([]);
    },
  });
  await seed(h);
  const first = h.sync();
  await started.promise;
  await h.enqueue(item("late"));
  const joined = h.sync();
  release.resolve();
  await Promise.all([first, joined]);
  assert.deepEqual(
    (await h.queue()).map((r) => r.id),
    ["operation"],
  );
  assert.equal(h.requests.filter((r) => r.log?.id === "late").length, 1);
  assertState(h, "failed", "rejected");
});
