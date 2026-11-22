import {
  buildGooglePlayStoreUrl,
  isAndroidUserAgent,
} from "./android-acquisition.mjs";

/** @typedef {"android-play" | "windows-store"} StorePlatform */
/** @typedef {"web_global_banner" | "web_quicklog_saved" | "about_platform_card" | "extension_handoff"} StoreCampaign */
/**
 * @typedef {{
 *   userAgent?: string | null;
 *   maxTouchPoints?: number;
 *   displayMode?: string;
 *   twaSignal?: string | null;
 *   embedded?: boolean;
 * }} StoreSurface
 */

export const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=app.ottline";
export const APP_STORE_URL = "https://apps.apple.com/app/ottline/id6780318110";
export const MAC_APP_STORE_URL =
  "https://apps.apple.com/app/id6780318110?platform=mac";
export const MICROSOFT_STORE_URL =
  "https://apps.microsoft.com/detail/9nsvnzgdmgf5";

export const STORE_CTA_DISMISSED_AT_KEYS = {
  "android-play": "ottline.androidPlayCta.dismissedAt",
  "windows-store": "ottline.windowsStoreCta.dismissedAt",
};

/** @param {string} locale */
export function localizedStoreUrls(locale) {
  const english = locale === "en";
  return {
    googlePlay: `${GOOGLE_PLAY_URL}${english ? "&hl=en" : "&hl=ko&gl=KR"}`,
    appStore: english
      ? APP_STORE_URL
      : "https://apps.apple.com/kr/app/ottline/id6780318110",
    macAppStore: english
      ? MAC_APP_STORE_URL
      : "https://apps.apple.com/kr/app/id6780318110?platform=mac",
    microsoftStore: `${MICROSOFT_STORE_URL}${english ? "?hl=en-us&gl=US" : "?hl=ko-kr&gl=KR"}`,
  };
}

/** @param {StoreSurface} options */
export function isEmbeddedStoreSurface({
  userAgent = "",
  maxTouchPoints = 0,
  embedded = false,
}) {
  if (embedded) return true;
  const ua = userAgent ?? "";
  if (
    /TossApp|apps-in-toss|\bwv\b|WebView|FBAN|FBAV|Instagram|KAKAOTALK|\bLine\/|MicroMessenger/i.test(
      ua,
    )
  ) {
    return true;
  }
  const ios =
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && maxTouchPoints > 1);
  // iOS WKWebView omits Safari; known standalone browsers remain eligible.
  return ios && !/Safari\/|CriOS\/|FxiOS\/|EdgiOS\/|OPiOS\//i.test(ua);
}

/**
 * Choose the surface before checking cooldowns, so a dismissed native CTA
 * cannot be replaced by a browser PWA prompt. iPadOS can advertise Macintosh.
 * @param {StoreSurface} options
 * @returns {StorePlatform | "ios-pwa" | "browser-pwa" | null}
 */
export function getInstallBannerMode({
  userAgent = "",
  maxTouchPoints = 0,
  displayMode = "browser",
  twaSignal = null,
  embedded = false,
}) {
  const ua = userAgent ?? "";
  if (
    isEmbeddedStoreSurface({ userAgent: ua, maxTouchPoints, embedded }) ||
    twaSignal
  ) {
    return null;
  }
  if (isAndroidUserAgent(ua)) {
    return displayMode === "browser" || displayMode === "standalone"
      ? "android-play"
      : null;
  }
  if (displayMode !== "browser") return null;
  if (
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && maxTouchPoints > 1)
  ) {
    return "ios-pwa";
  }
  if (/Windows Phone/i.test(ua)) return null;
  if (/Windows NT/i.test(ua)) return "windows-store";
  return /Macintosh|Mac OS X|X11|Linux|CrOS/i.test(ua) ? "browser-pwa" : null;
}

/** @param {StoreSurface} options @returns {StorePlatform | null} */
export function getNativeStorePlatform(options) {
  const mode = getInstallBannerMode(options);
  return mode === "browser-pwa" || mode === "ios-pwa" ? null : mode;
}

/**
 * Only fixed placements and locale enter external URLs. Never copy the page
 * URL, storage, pairingCode, userId, recordId, or deviceId into attribution.
 * Microsoft uses the HTTPS PDP so every browser has a working web fallback.
 * @param {{
 *   platform: StorePlatform;
 *   locale: string;
 *   campaign: StoreCampaign;
 *   content?: string;
 *   webHandoff?: boolean;
 * }} options
 */
export function buildNativeStoreUrl({
  platform,
  locale,
  campaign,
  content = "",
  webHandoff = false,
}) {
  const androidCampaigns = {
    web_global_banner: "android_play_cta",
    web_quicklog_saved: "quicklog_saved",
    about_platform_card: "about_platform_card",
    extension_handoff: null,
  };
  if (!Object.hasOwn(androidCampaigns, campaign)) {
    throw new TypeError("Unknown store campaign");
  }
  const urls = localizedStoreUrls(locale);
  if (platform === "android-play") {
    const androidCampaign = androidCampaigns[campaign];
    if (!androidCampaign) throw new TypeError("Unsupported Android campaign");
    const allowedContent = [
      "global_banner_browser",
      "global_banner_pwa",
      "saved_stage_cta",
      "platform_card",
    ];
    return buildGooglePlayStoreUrl({
      baseUrl: urls.googlePlay,
      campaign: androidCampaign,
      content: allowedContent.includes(content) ? content : "",
      webHandoff: webHandoff === true,
    });
  }
  if (platform === "windows-store") {
    const url = new URL(urls.microsoftStore);
    url.searchParams.set("cid", campaign);
    return url.toString();
  }
  throw new TypeError("Unknown store platform");
}
