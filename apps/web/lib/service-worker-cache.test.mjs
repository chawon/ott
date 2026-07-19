import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workerSource = readFileSync(
  path.join(webRoot, "public", "sw.js"),
  "utf8",
);
const layoutSource = readFileSync(
  path.join(webRoot, "app", "[locale]", "layout.tsx"),
  "utf8",
);

function createWorkerHarness({ cacheKeys = [] } = {}) {
  const listeners = new Map();
  const deletedCacheKeys = [];

  const context = {
    URL,
    Promise,
    self: {
      location: { origin: "https://ottline.app" },
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      skipWaiting() {},
      clients: { claim() {} },
    },
    caches: {
      async match() {
        return new Response("stale-cache-entry");
      },
      async open() {
        return {
          async addAll() {},
          async put() {},
        };
      },
      async keys() {
        return cacheKeys;
      },
      async delete(key) {
        deletedCacheKeys.push(key);
        return true;
      },
    },
    async fetch() {
      return new Response("current-network-entry");
    },
  };

  vm.runInNewContext(workerSource, context, { filename: "sw.js" });
  return { listeners, deletedCacheKeys };
}

test("bypasses persistent Cache Storage for Next RSC navigation data", () => {
  const { listeners } = createWorkerHarness();
  const request = new Request(
    "https://ottline.app/timeline?_rsc=current-build",
    {
      headers: {
        RSC: "1",
        "Next-Router-Prefetch": "1",
      },
    },
  );
  let responsePromise;

  listeners.get("fetch")({
    request,
    respondWith(promise) {
      responsePromise = promise;
    },
  });

  assert.equal(
    responsePromise,
    undefined,
    "the browser must fetch RSC data directly from the current deployment",
  );
});

test("bypasses the service worker for every admin request", () => {
  const { listeners } = createWorkerHarness();
  for (const pathname of [
    "/admin",
    "/admin/analytics",
    "/admin/api/feedback/threads",
    "/ko/admin/analytics",
    "/en/admin",
  ]) {
    const request = new Request(`https://ottline.app${pathname}`);
    let responsePromise;

    listeners.get("fetch")({
      request,
      respondWith(promise) {
        responsePromise = promise;
      },
    });

    assert.equal(
      responsePromise,
      undefined,
      `${pathname} must go directly to Cloudflare Access and the network`,
    );
  }
});

test("removes the previous ottline cache when the worker activates", async () => {
  const { listeners, deletedCacheKeys } = createWorkerHarness({
    cacheKeys: [
      "ottline-cache-v1",
      "ottline-cache-v2",
      "ott-pwa-v1",
      "unrelated-origin-cache",
    ],
  });
  let activationPromise;

  listeners.get("activate")({
    waitUntil(promise) {
      activationPromise = promise;
    },
  });
  await activationPromise;

  assert.deepEqual(deletedCacheKeys, [
    "ottline-cache-v1",
    "ottline-cache-v2",
    "ott-pwa-v1",
  ]);
});

test("checks for the current worker even when hydration starts after load", () => {
  assert.match(layoutSource, /updateViaCache: "none"/);
  assert.match(layoutSource, /document\.readyState === "complete"/);
  assert.match(
    layoutSource,
    /window\.addEventListener\("load", registerServiceWorker, \{ once: true \}\)/,
  );
});
