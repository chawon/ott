import { trackEvent } from "./analytics";
import type { StorePlatform } from "./store-acquisition.mjs";

const events = {
  "android-play": {
    impression: "android_play_cta_impression",
    click: "android_play_cta_click",
    dismiss: "android_play_cta_dismiss",
  },
  "windows-store": {
    impression: "windows_store_cta_impression",
    click: "windows_store_cta_click",
    dismiss: "windows_store_cta_dismiss",
  },
} as const;

export function trackStoreCta(
  platform: StorePlatform,
  action: "impression" | "click" | "dismiss",
  properties: Record<string, unknown>,
) {
  return trackEvent(events[platform][action], properties);
}
