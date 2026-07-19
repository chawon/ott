import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const read = (...segments) =>
  readFileSync(path.join(webRoot, ...segments), "utf8");

test("admin root layout excludes product, analytics, and PWA runtime scripts", () => {
  const layout = read("app", "admin", "layout.tsx");
  for (const forbidden of [
    "next/script",
    "gtag",
    "clarity",
    "SyncWorker",
    "serviceWorker",
    "AppHeader",
    "BottomNav",
  ]) {
    assert.doesNotMatch(layout, new RegExp(forbidden, "i"));
  }
  assert.match(layout, /index:\s*false/);
  assert.match(layout, /follow:\s*false/);
});

test("feedback browser code calls the admin BFF without an admin token", () => {
  const consoleSource = read("components", "AdminFeedbackConsole.tsx");
  assert.match(consoleSource, /fetch\(`\/admin\/api\/feedback\$\{path\}`/);
  assert.doesNotMatch(consoleSource, /X-Admin-Token/);
  assert.doesNotMatch(consoleSource, /token:\s*string/);

  const bffSource = read(
    "app",
    "admin",
    "api",
    "feedback",
    "[...path]",
    "route.ts",
  );
  assert.match(bffSource, /verifyCloudflareAccessRequest/);
  assert.match(bffSource, /"X-Admin-Token": adminToken/);
  assert.match(bffSource, /origin !== new URL\(request\.url\)\.origin/);
  assert.match(bffSource, /\/internal\/admin\/feedback\/threads/);
  assert.doesNotMatch(bffSource, /return `\/api\/admin/);
});

test("admin server pages use internal backend routes and acquisition contract", () => {
  const analytics = read("app", "admin", "analytics", "page.tsx");
  const report = read("app", "admin", "report", "page.tsx");

  assert.match(analytics, /\/internal\/admin\/analytics\/overview/);
  assert.match(analytics, /\/internal\/admin\/analytics\/events/);
  assert.match(analytics, /\/internal\/admin\/analytics\/acquisition/);
  for (const field of [
    "engagedSessions",
    "firstLogSessions",
    "logCreateSessions",
    "byChannel",
    "byLandingPath",
    "byCampaign",
    "orphanConversionSessions",
  ]) {
    assert.match(analytics, new RegExp(field));
  }
  assert.match(report, /\/internal\/admin\/report\/daily/);
  assert.doesNotMatch(`${analytics}\n${report}`, /\/api\/admin\//);
});

test("legacy admin pages redirect without reading query tokens", () => {
  for (const route of ["analytics", "report", "feedback"]) {
    const source = read("app", "[locale]", "admin", route, "page.tsx");
    assert.match(source, new RegExp(`redirect\\("/admin/${route}"\\)`));
    assert.doesNotMatch(source, /searchParams|token/i);
  }
});
