export const AUTH_RECOVERY_STORAGE_KEY = "ottline.auth-recovery.at";
export const AUTH_RECOVERY_WINDOW_MS = 10_000;
export const CHUNK_RECOVERY_STORAGE_KEY = "ottline.chunk-recovery.at";
export const CHUNK_RECOVERY_WINDOW_MS = 10_000;

/**
 * A device can only be revoked when the request actually carried local device
 * identity. Generic 401/403 responses must remain ordinary request failures.
 *
 * @param {number} status
 * @param {boolean} sentUserId
 * @param {boolean} sentDeviceId
 */
export function shouldResetLocalAuth(status, sentUserId, sentDeviceId) {
  return status === 401 && (sentUserId || sentDeviceId);
}

/**
 * @param {unknown} reason
 */
export function isChunkLoadError(reason) {
  return Boolean(reason && reason.name === "ChunkLoadError");
}

/**
 * @param {string} key
 */
export function isOttlineCacheKey(key) {
  return key.startsWith("ottline-cache-") || key.startsWith("ott-pwa-");
}

/**
 * @param {string | null} storedAttemptAt
 * @param {number} now
 * @param {number} [windowMs]
 */
export function shouldAttemptChunkRecovery(
  storedAttemptAt,
  now,
  windowMs = CHUNK_RECOVERY_WINDOW_MS,
) {
  return shouldAttemptRecovery(storedAttemptAt, now, windowMs);
}

/**
 * @param {string | null} storedAttemptAt
 * @param {number} now
 */
export function shouldAttemptAuthRecovery(storedAttemptAt, now) {
  return shouldAttemptRecovery(storedAttemptAt, now, AUTH_RECOVERY_WINDOW_MS);
}

/**
 * @param {string | null} storedAttemptAt
 * @param {number} now
 * @param {number} windowMs
 */
function shouldAttemptRecovery(storedAttemptAt, now, windowMs) {
  if (!storedAttemptAt) return true;
  const previousAttemptAt = Number(storedAttemptAt);
  if (!Number.isFinite(previousAttemptAt)) return true;
  return now - previousAttemptAt >= windowMs;
}
