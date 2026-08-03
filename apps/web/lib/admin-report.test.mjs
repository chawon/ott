import assert from "node:assert/strict";
import test from "node:test";

import {
  formatKstSnapshotTime,
  resolveCloudflareVisits,
} from "./admin-report.mjs";

test("uses Cloudflare visits without treating it as unique visitors", () => {
  assert.equal(resolveCloudflareVisits({ visits: 8, uniqueVisitors: 99 }), 8);
  assert.equal(resolveCloudflareVisits({ visits: 0, uniqueVisitors: 99 }), 0);
});

test("keeps compatibility with an API that only has uniqueVisitors", () => {
  assert.equal(resolveCloudflareVisits({ uniqueVisitors: 8 }), 8);
  assert.equal(resolveCloudflareVisits({}), 0);
});

test("formats the report generation time as a KST snapshot", () => {
  assert.equal(
    formatKstSnapshotTime("2026-08-03T05:35:00Z"),
    "2026-08-03 14:35 KST",
  );
  assert.equal(formatKstSnapshotTime("not-a-date"), null);
  assert.equal(formatKstSnapshotTime(undefined), null);
});
