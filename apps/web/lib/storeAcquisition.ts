import { trackEvent } from "./analytics";
import { isDismissalCooldownActive } from "./android-acquisition.mjs";
import { getGooglePlayTwaSignal } from "./androidAppContext";
import {
  appleDevice,
  getNativeStorePlatform,
  isAppleStore,
  STORE_CTA_DISMISSED_AT_KEYS,
  type StorePlatform,
} from "./store-acquisition.mjs";

export function browserStoreSurface() {
  const navigator = window.navigator as Navigator & { standalone?: boolean };
  const displayMode = navigator.standalone
    ? "standalone"
    : ([
        "standalone",
        "minimal-ui",
        "fullscreen",
        "window-controls-overlay",
      ].find((mode) => window.matchMedia(`(display-mode: ${mode})`).matches) ??
      "browser");
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    displayMode,
    twaSignal: getGooglePlayTwaSignal(),
    embedded: window.self !== window.top,
  };
}

const dismissed = new Map<StorePlatform, string>();
export const STORE_OFFER_CHANGED = "ottline:store-offer-changed";
export function storeOfferSuppressed(platform: StorePlatform) {
  if (isDismissalCooldownActive(dismissed.get(platform))) return true;
  try {
    return isDismissalCooldownActive(
      localStorage.getItem(STORE_CTA_DISMISSED_AT_KEYS[platform]),
    );
  } catch {
    return false;
  }
}
export function dismissStoreOffer(platform: StorePlatform) {
  const at = String(Date.now());
  dismissed.set(platform, at);
  try {
    localStorage.setItem(STORE_CTA_DISMISSED_AT_KEYS[platform], at);
  } catch {
    /* In-memory dismissal still applies to this page. */
  }
  // Let an activated store link finish its native navigation before hiding it.
  window.setTimeout(
    () => window.dispatchEvent(new Event(STORE_OFFER_CHANGED)),
    0,
  );
}

const events = {
  "android-play": {
    impression: "android_play_cta_impression",
    click: "android_play_cta_click",
    dismiss: "android_play_cta_dismiss",
  },
  "ios-appstore": {
    impression: "ios_appstore_cta_impression",
    click: "ios_appstore_cta_click",
    dismiss: "ios_appstore_cta_dismiss",
  },
  "macos-appstore": {
    impression: "macos_appstore_cta_impression",
    click: "macos_appstore_cta_click",
    dismiss: "macos_appstore_cta_dismiss",
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
  if (isAppleStore(platform)) {
    const surface = browserStoreSurface();
    // Directory links remain accessible to everyone. Measure the experiment
    // only for this store's matching, ordinary browser audience.
    if (getNativeStorePlatform(surface) !== platform) return;
    return trackEvent(events[platform][action], {
      ...properties,
      targetDevice: appleDevice(surface),
    });
  }
  return trackEvent(events[platform][action], properties);
}
