import { ensureAuthIds } from "./api";
import { getUserId } from "./localStore";
import type { RecommendationState } from "./types";

// The API can hold the generation lease for two minutes.
export const RECOMMENDATION_GENERATION_TIMEOUT_MS = 125_000;

const REQUEST_TIMEOUTS: Partial<Record<string, number>> = {
  "/state": 10_000,
  "/generate": RECOMMENDATION_GENERATION_TIMEOUT_MS,
};

export function recommendationDeadline(parent: AbortSignal, timeout: number) {
  if (
    typeof AbortSignal.any === "function" &&
    typeof AbortSignal.timeout === "function"
  ) {
    return {
      signal: AbortSignal.any([parent, AbortSignal.timeout(timeout)]),
      dispose() {},
    };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    dispose();
    controller.abort(
      new DOMException("Recommendation request timed out", "TimeoutError"),
    );
  }, timeout);
  function dispose() {
    window.clearTimeout(timer);
    parent.removeEventListener("abort", abort);
  }
  function abort() {
    dispose();
    controller.abort(parent.reason);
  }
  if (parent.aborted) abort();
  else parent.addEventListener("abort", abort, { once: true });
  return { signal: controller.signal, dispose };
}

export class RecommendationRequestError extends Error {
  constructor(
    public status: number,
    public state: RecommendationState | null,
  ) {
    super(`Recommendation request failed (${status})`);
  }
}

/** Capture account headers after auth settles; a queued operation never follows a new account. */
export async function recommendationRequest<T>(
  path: string,
  scope: { userId: string; locale: string; signal: AbortSignal },
  init: RequestInit = {},
): Promise<{ status: number; data: T }> {
  const auth = await ensureAuthIds({ register: true });
  if (
    scope.signal.aborted ||
    auth.userId !== scope.userId ||
    getUserId() !== scope.userId
  ) {
    throw new DOMException("Recommendation account changed", "AbortError");
  }
  const headers = new Headers(init.headers);
  headers.set("X-User-Id", scope.userId);
  if (auth.deviceId) headers.set("X-Device-Id", auth.deviceId);
  headers.set("Accept-Language", scope.locale);
  if (init.body) headers.set("Content-Type", "application/json");
  if (/\.ngrok-free\.(?:app|dev)$/.test(window.location.hostname))
    headers.set("ngrok-skip-browser-warning", "true");
  const timeout = REQUEST_TIMEOUTS[path];
  const deadline = timeout
    ? recommendationDeadline(scope.signal, timeout)
    : null;
  try {
    const response = await fetch(`/api/recommendations${path}`, {
      ...init,
      headers,
      signal: deadline?.signal ?? scope.signal,
      cache: "no-store",
      credentials: "same-origin",
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new RecommendationRequestError(
        response.status,
        data &&
          typeof data === "object" &&
          data.quota &&
          Array.isArray(data.items)
          ? data
          : null,
      );
    }
    return { status: response.status, data };
  } finally {
    deadline?.dispose();
  }
}
