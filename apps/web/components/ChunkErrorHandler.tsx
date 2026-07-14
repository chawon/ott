"use client";

import { useEffect } from "react";
import {
  CHUNK_RECOVERY_STORAGE_KEY,
  CHUNK_RECOVERY_WINDOW_MS,
  isChunkLoadError,
  isOttlineCacheKey,
  shouldAttemptChunkRecovery,
} from "@/lib/client-recovery.mjs";

let recoveryInProgress = false;

function readLastRecoveryAttempt() {
  try {
    return window.sessionStorage.getItem(CHUNK_RECOVERY_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberRecoveryAttempt(at: number) {
  try {
    window.sessionStorage.setItem(CHUNK_RECOVERY_STORAGE_KEY, String(at));
  } catch {
    // Recovery still proceeds when session storage is unavailable.
  }
}

function clearRecoveryAttempt() {
  try {
    window.sessionStorage.removeItem(CHUNK_RECOVERY_STORAGE_KEY);
  } catch {
    // Nothing to clear when session storage is unavailable.
  }
}

async function clearStaleAppCaches() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(
    keys.filter(isOttlineCacheKey).map((key) => caches.delete(key)),
  );
}

async function updateServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations.map((registration) => registration.update()),
  );
}

async function recoverFromChunkError() {
  await Promise.allSettled([clearStaleAppCaches(), updateServiceWorkers()]);
  window.location.reload();
}

export default function ChunkErrorHandler() {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadError(event.reason)) return;
      if (recoveryInProgress) {
        event.preventDefault();
        return;
      }

      const now = Date.now();
      if (!shouldAttemptChunkRecovery(readLastRecoveryAttempt(), now)) return;

      event.preventDefault();
      recoveryInProgress = true;
      rememberRecoveryAttempt(now);
      void recoverFromChunkError();
    };

    const stableTimer = window.setTimeout(
      clearRecoveryAttempt,
      CHUNK_RECOVERY_WINDOW_MS,
    );
    window.addEventListener("unhandledrejection", handler);
    return () => {
      window.clearTimeout(stableTimer);
      window.removeEventListener("unhandledrejection", handler);
    };
  }, []);
  return null;
}
