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

function createWorkerHarness({ cacheKeys = [], offline = false } = {}) {
  const listeners = new Map();
  const deletedCacheKeys = [];
  const precacheRequests = [];
  const matchedPaths = [];

  const context = {
    URL,
    Promise,
    Request,
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
          async addAll(requests) {
            precacheRequests.push(...requests);
          },
          async match(pathname) {
            matchedPaths.push(pathname);
            return new Response(`offline notice: ${pathname}`);
          },
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
      if (offline) throw new TypeError("Network unavailable");
      return new Response("current-network-entry");
    },
  };

  vm.runInNewContext(workerSource, context, { filename: "sw.js" });
  return { listeners, deletedCacheKeys, precacheRequests, matchedPaths };
}

test("precaches self-contained notices without locale redirects or stale HTTP assets", async () => {
  const { listeners, precacheRequests } = createWorkerHarness();
  let installation;
  listeners.get("install")({
    waitUntil: (promise) => {
      installation = promise;
    },
  });
  await installation;

  const paths = precacheRequests.map(
    (request) => new URL(request.url).pathname,
  );
  assert.ok(paths.includes("/offline/ko.html"));
  assert.ok(paths.includes("/offline/en.html"));
  for (const pathname of ["/", "/timeline", "/offline"]) {
    assert.ok(!paths.includes(pathname), `${pathname} can redirect by locale`);
  }
  assert.ok(precacheRequests.every((request) => request.cache === "reload"));
});

test("offline navigations receive the notice matching the route locale", async () => {
  const { listeners, matchedPaths } = createWorkerHarness({ offline: true });
  for (const [pathname, locale] of [
    ["/", "ko"],
    ["/timeline?sort=history", "ko"],
    ["/ko/timeline", "ko"],
    ["/en", "en"],
    ["/en/timeline", "en"],
    ["/enough", "ko"],
  ]) {
    let responsePromise;
    listeners.get("fetch")({
      request: {
        url: `https://ottline.app${pathname}`,
        method: "GET",
        mode: "navigate",
        headers: new Headers(),
      },
      respondWith: (promise) => {
        responsePromise = promise;
      },
    });
    const response = await responsePromise;
    assert.equal(
      await response.text(),
      `offline notice: /offline/${locale}.html`,
    );
    assert.equal(matchedPaths.at(-1), `/offline/${locale}.html`);
  }
});

test("successful HTML navigation still returns the network response", async () => {
  const { listeners, matchedPaths } = createWorkerHarness();
  let responsePromise;
  listeners.get("fetch")({
    request: {
      url: "https://ottline.app/en/timeline",
      method: "GET",
      mode: "navigate",
      headers: new Headers(),
    },
    respondWith: (promise) => {
      responsePromise = promise;
    },
  });
  assert.equal(await (await responsePromise).text(), "current-network-entry");
  assert.deepEqual(matchedPaths, []);
});

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
      "ottline-cache-v6",
      "ottline-cache-v7",
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
    "ottline-cache-v6",
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
