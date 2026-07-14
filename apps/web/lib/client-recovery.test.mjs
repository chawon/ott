import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_RECOVERY_STORAGE_KEY,
  CHUNK_RECOVERY_WINDOW_MS,
  isChunkLoadError,
  isOttlineCacheKey,
  shouldAttemptAuthRecovery,
  shouldAttemptChunkRecovery,
  shouldResetLocalAuth,
} from "./client-recovery.mjs";

test("does not reload for generic forbidden responses", () => {
  assert.equal(shouldResetLocalAuth(403, false, false), false);
  assert.equal(shouldResetLocalAuth(403, true, true), false);
});

test("resets local auth only for unauthorized requests that sent identity", () => {
  assert.equal(shouldResetLocalAuth(401, false, false), false);
  assert.equal(shouldResetLocalAuth(401, true, false), true);
  assert.equal(shouldResetLocalAuth(401, false, true), true);
});

test("recognizes only real chunk-load errors", () => {
  assert.equal(isChunkLoadError({ name: "ChunkLoadError" }), true);
  assert.equal(isChunkLoadError({ name: "TypeError" }), false);
  assert.equal(isChunkLoadError(null), false);
});

test("recognizes current and legacy ottline Cache Storage keys", () => {
  assert.equal(isOttlineCacheKey("ottline-cache-v1"), true);
  assert.equal(isOttlineCacheKey("ottline-cache-v2"), true);
  assert.equal(isOttlineCacheKey("ott-pwa-v1"), true);
  assert.equal(isOttlineCacheKey("unrelated-origin-cache"), false);
});

test("allows one chunk recovery attempt per stability window", () => {
  const now = 10_000;
  assert.equal(shouldAttemptChunkRecovery(null, now), true);
  assert.equal(shouldAttemptChunkRecovery("invalid", now), true);
  assert.equal(shouldAttemptChunkRecovery(String(now - 500), now), false);
  assert.equal(
    shouldAttemptChunkRecovery(String(now - CHUNK_RECOVERY_WINDOW_MS), now),
    true,
  );
});

test("limits auth recovery reloads across full document reloads", () => {
  const now = 20_000;
  assert.equal(AUTH_RECOVERY_STORAGE_KEY, "ottline.auth-recovery.at");
  assert.equal(shouldAttemptAuthRecovery(null, now), true);
  assert.equal(shouldAttemptAuthRecovery(String(now - 500), now), false);
  assert.equal(shouldAttemptAuthRecovery(String(now - 10_000), now), true);
});
