import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  extractSitemapUrls,
  INDEXNOW_KEY,
  notifyIndexNow,
  runCommand,
  waitForProductionVersion,
} from "./ping-indexnow.mjs";

test("extracts unique ottline URLs and ignores foreign origins", () => {
  const xml = `<?xml version="1.0"?>
    <urlset>
      <url><loc>https://ottline.app/</loc></url>
      <url><loc>https://ottline.app/en/about</loc></url>
      <url><loc>https://example.com/copied</loc></url>
      <url><loc>https://ottline.app/en/about</loc></url>
    </urlset>`;

  assert.deepEqual(extractSitemapUrls(xml), [
    "https://ottline.app/",
    "https://ottline.app/en/about",
  ]);
});

test("submits the live sitemap URL set with the canonical key", async () => {
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url, init });
    if (String(url).endsWith("/sitemap.xml")) {
      return new Response(
        "<urlset><url><loc>https://ottline.app/guide</loc></url></urlset>",
        { status: 200 },
      );
    }
    return new Response("", { status: 202 });
  };

  const result = await notifyIndexNow({ fetchImpl });
  const payload = JSON.parse(requests[1].init.body);

  assert.deepEqual(result, { status: 202, submitted: 1 });
  assert.equal(payload.key, INDEXNOW_KEY);
  assert.deepEqual(payload.urlList, ["https://ottline.app/guide"]);
});

test("fails on any non-success IndexNow response", async () => {
  const fetchImpl = async (url) =>
    String(url).endsWith("/sitemap.xml")
      ? new Response(
          "<urlset><url><loc>https://ottline.app/</loc></url></urlset>",
          { status: 200 },
        )
      : new Response("invalid key", { status: 403 });

  await assert.rejects(notifyIndexNow({ fetchImpl }), /IndexNow failed: 403/);
});

test("waits for the requested production version", async () => {
  const versions = ["old0000", "abc1234"];
  let versionRequests = 0;
  const fetchImpl = async () => {
    const version = versions[Math.min(versionRequests, versions.length - 1)];
    versionRequests += 1;
    return new Response(version, { status: 200 });
  };

  await waitForProductionVersion({
    expectedVersion: "abc1234fullsha",
    fetchImpl,
    attempts: 3,
    delayMs: 0,
    sleepImpl: async () => {},
  });

  assert.equal(versionRequests, 2);
});

test("keeps production verification separate from IndexNow notification", async () => {
  const requests = [];
  const result = await runCommand("verify-production", {
    expectedVersion: "abc1234fullsha",
    fetchImpl: async (url) => {
      requests.push(String(url));
      return new Response("abc1234", { status: 200 });
    },
    attempts: 1,
  });

  assert.deepEqual(result, { action: "verified", version: "abc1234" });
  assert.deepEqual(requests, [
    "https://ottline.app/.well-known/ottline-version",
  ]);
});

test("requires an expected version for the required verification command", async () => {
  await assert.rejects(
    runCommand("verify-production"),
    /EXPECTED_APP_VERSION is required/,
  );
});

test("production workflow keeps verification required and IndexNow best effort", () => {
  const workflow = readFileSync(
    new URL(
      "../../../.github/workflows/deploy-web-production.yml",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    workflow,
    /run: node apps\/web\/scripts\/ping-indexnow\.mjs verify-production/,
  );
  assert.match(workflow, /name: Notify IndexNow \(Bing, best effort\)/);
  assert.match(workflow, /continue-on-error: true/);
});
