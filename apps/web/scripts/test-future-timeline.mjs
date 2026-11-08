/** Compatibility entry point for the server-authoritative Future timeline regressions. */
const previousCases = {
  "exclusion-refresh": "cross-device",
  "refresh-failure": "retry",
  "initial-failure": "retry",
  "all-hidden": "empty",
  "account-switch": "scope",
  "locale-switch": "quota",
  "legacy-migration": "legacy",
  "dismiss-undo": "pending",
};
if (process.env.FUTURE_QA_CASE && previousCases[process.env.FUTURE_QA_CASE]) {
  process.env.FUTURE_QA_CASE = previousCases[process.env.FUTURE_QA_CASE];
}
await import("./test-future-timeline-state.mjs");
