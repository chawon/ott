import assert from "node:assert/strict";
import test from "node:test";
import {
  ANDROID_ACQUISITION_COOLDOWN_MS,
  isDismissalCooldownActive,
} from "./android-acquisition.mjs";
import {
  buildNativeStoreUrl,
  getInstallBannerMode,
  getNativeStorePlatform,
  localizedStoreUrls,
  STORE_CTA_DISMISSED_AT_KEYS,
} from "./store-acquisition.mjs";

const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/143.0 Safari/537.36 Edg/143.0";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/143.0 Mobile Safari/537.36";
const IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 Version/18.2 Mobile/15E148 Safari/604.1";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.2 Safari/605.1.15";
const LINUX =
  "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 Chrome/143.0 Safari/537.36";

test("Windows browsers prefer Microsoft Store; installed Windows PWA is excluded", () => {
  assert.equal(getInstallBannerMode({ userAgent: WINDOWS }), "windows-store");
  assert.equal(getNativeStorePlatform({ userAgent: WINDOWS }), "windows-store");
  for (const displayMode of ["standalone", "minimal-ui", "fullscreen"]) {
    assert.equal(
      getInstallBannerMode({ userAgent: WINDOWS, displayMode }),
      null,
    );
    assert.equal(
      getNativeStorePlatform({ userAgent: WINDOWS, displayMode }),
      null,
    );
  }
});

test("Android browser/PWA and TWA boundaries are retained", () => {
  for (const displayMode of ["browser", "standalone"]) {
    assert.equal(
      getNativeStorePlatform({ userAgent: ANDROID, displayMode }),
      "android-play",
    );
    for (const twaSignal of [
      "android_referrer",
      "versioned_launch_url",
      "install_token",
      "session",
    ]) {
      assert.equal(
        getInstallBannerMode({ userAgent: ANDROID, displayMode, twaSignal }),
        null,
      );
    }
  }
});

test("iOS retains PWA guidance and never receives a new native store CTA", () => {
  for (const surface of [
    { userAgent: IOS },
    { userAgent: MAC, maxTouchPoints: 5 },
  ]) {
    assert.equal(getInstallBannerMode(surface), "ios-pwa");
    assert.equal(getNativeStorePlatform(surface), null);
    assert.equal(
      getInstallBannerMode({ ...surface, displayMode: "standalone" }),
      null,
    );
  }
});

test("macOS and Linux retain browser installation only", () => {
  for (const userAgent of [MAC, LINUX]) {
    assert.equal(getInstallBannerMode({ userAgent }), "browser-pwa");
    assert.equal(getNativeStorePlatform({ userAgent }), null);
    assert.equal(
      getInstallBannerMode({ userAgent, displayMode: "standalone" }),
      null,
    );
  }
});

test("embedded apps, Android WebViews, iOS WKWebViews, and frames suppress acquisition prompts", () => {
  for (const userAgent of [WINDOWS, ANDROID, IOS, MAC, LINUX]) {
    assert.equal(getInstallBannerMode({ userAgent, embedded: true }), null);
    for (const token of [
      "TossApp/5.0",
      "apps-in-toss",
      "Instagram 123",
      "KAKAOTALK",
      "FBAN/FBIOS",
      "WebView2",
    ]) {
      assert.equal(
        getInstallBannerMode({ userAgent: `${userAgent} ${token}` }),
        null,
      );
    }
  }
  assert.equal(
    getInstallBannerMode({
      userAgent: ANDROID.replace("Android 16;", "Android 16; wv;"),
    }),
    null,
  );
  assert.equal(
    getInstallBannerMode({
      userAgent: IOS.replace("Version/18.2 ", "").replace("Safari/604.1", ""),
    }),
    null,
  );
});

test("unknown user agents have no speculative install prompt", () => {
  for (const userAgent of [null, undefined, "", "SomeUnknownBrowser"]) {
    assert.equal(getInstallBannerMode({ userAgent }), null);
  }
});

test("Windows cooldown has an independent storage key and exact 14-day boundary", () => {
  assert.equal(
    STORE_CTA_DISMISSED_AT_KEYS["android-play"],
    "ottline.androidPlayCta.dismissedAt",
  );
  assert.equal(
    STORE_CTA_DISMISSED_AT_KEYS["windows-store"],
    "ottline.windowsStoreCta.dismissedAt",
  );
  assert.notEqual(
    STORE_CTA_DISMISSED_AT_KEYS["windows-store"],
    STORE_CTA_DISMISSED_AT_KEYS["android-play"],
  );
  const now = Date.UTC(2026, 10, 17);
  const boundary = now - ANDROID_ACQUISITION_COOLDOWN_MS;
  assert.equal(isDismissalCooldownActive(String(boundary + 1), now), true);
  assert.equal(isDismissalCooldownActive(String(boundary), now), false);
  for (const invalid of [
    null,
    "",
    " ",
    "garbage",
    "Infinity",
    "-1",
    String(now + 1),
  ]) {
    assert.equal(isDismissalCooldownActive(invalid, now), false);
  }
});

test("Windows public links carry only locale and the three fixed cid placements", () => {
  for (const locale of ["ko", "en"]) {
    const plainUrl = new URL(localizedStoreUrls(locale).microsoftStore);
    assert.equal(
      plainUrl.searchParams.get("hl"),
      locale === "ko" ? "ko-kr" : "en-us",
    );
    assert.equal(
      plainUrl.searchParams.get("gl"),
      locale === "ko" ? "KR" : "US",
    );
    assert.equal(plainUrl.searchParams.has("cid"), false);
    for (const campaign of [
      "web_global_banner",
      "web_quicklog_saved",
      "about_platform_card",
    ]) {
      const url = new URL(
        buildNativeStoreUrl({
          platform: "windows-store",
          locale,
          campaign,
          pairingCode: "PRIVATE-CODE",
          userId: "PRIVATE-USER",
          deviceId: "PRIVATE-DEVICE",
          recordId: "PRIVATE-RECORD",
          content: "PRIVATE-CONTENT",
          baseUrl: "https://untrusted.invalid/?userId=PRIVATE-USER",
          webHandoff: true,
        }),
      );
      assert.equal(url.origin, "https://apps.microsoft.com");
      assert.equal(url.pathname, "/detail/9nsvnzgdmgf5");
      assert.deepEqual([...url.searchParams.keys()].sort(), [
        "cid",
        "gl",
        "hl",
      ]);
      assert.equal(url.searchParams.get("cid"), campaign);
      assert.equal(url.hash, "");
      assert.doesNotMatch(
        decodeURIComponent(url.toString()),
        /PRIVATE|pairing|userId|deviceId|recordId/i,
      );
    }
  }
});

test("private or unknown strings cannot become campaign values", () => {
  for (const campaign of [
    "PRIVATE-USER",
    "web_global_banner&userId=PRIVATE-USER",
    "constructor",
    "__proto__",
    "",
  ]) {
    assert.throws(
      () =>
        buildNativeStoreUrl({
          platform: "windows-store",
          locale: "ko",
          campaign,
        }),
      TypeError,
    );
  }
});

test("Android shared builder preserves global and saved campaign/handoff contracts", () => {
  for (const [campaign, expected, content] of [
    ["web_global_banner", "android_play_cta", "global_banner_pwa"],
    ["web_quicklog_saved", "quicklog_saved", "saved_stage_cta"],
  ]) {
    const url = new URL(
      buildNativeStoreUrl({
        platform: "android-play",
        locale: "ko",
        campaign,
        content,
        webHandoff: true,
        userId: "PRIVATE-USER",
        pairingCode: "PRIVATE-CODE",
      }),
    );
    const referrer = new URLSearchParams(url.searchParams.get("referrer"));
    assert.equal(referrer.get("utm_source"), "ottline_web");
    assert.equal(referrer.get("utm_medium"), "owned");
    assert.equal(referrer.get("utm_campaign"), expected);
    assert.equal(referrer.get("utm_content"), content);
    assert.equal(referrer.get("web_handoff"), "1");
    assert.doesNotMatch(
      decodeURIComponent(url.toString()),
      /PRIVATE|pairing|userId/,
    );
  }
});

test("App Store listing stays unchanged in this Windows-only phase", () => {
  for (const locale of ["ko", "en"]) {
    const url = new URL(localizedStoreUrls(locale).appStore);
    assert.equal(url.hostname, "apps.apple.com");
    assert.equal(url.search, "");
    assert.match(url.pathname, /id6780318110$/);
  }
});
