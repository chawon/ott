import assert from "node:assert/strict";
import test from "node:test";

import {
  ANDROID_ACQUISITION_COOLDOWN_MS,
  googlePlayTwaSignal,
  isDismissalCooldownActive,
  isOttlineAndroidAppReferrer,
  shouldShowAndroidPlayPrompt,
  shouldShowAndroidReminderCard,
} from "./android-acquisition.mjs";

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36";

test("accepts only installed-app TWA signals", () => {
  assert.equal(
    googlePlayTwaSignal({
      userAgent: ANDROID_UA,
      referrer: "android-app://app.ottline/",
      search: "",
    }),
    "android_referrer",
  );
  assert.equal(
    googlePlayTwaSignal({
      userAgent: ANDROID_UA,
      referrer: "",
      search: "?android_app_version=1.0.13&android_app_version_code=17",
    }),
    "versioned_launch_url",
  );
  assert.equal(
    googlePlayTwaSignal({
      userAgent: ANDROID_UA,
      referrer: "",
      search: "?android_install_token=device-token",
    }),
    "install_token",
  );
  assert.equal(
    googlePlayTwaSignal({
      userAgent: ANDROID_UA,
      referrer: "",
      search: "",
      sessionRecorded: true,
    }),
    "session",
  );
});

test("does not treat generic Android WebView or standalone PWA as TWA", () => {
  assert.equal(
    googlePlayTwaSignal({
      userAgent: `${ANDROID_UA} wv`,
      referrer: "https://m.search.naver.com/",
      search: "",
    }),
    null,
  );
  assert.equal(
    googlePlayTwaSignal({
      userAgent: ANDROID_UA,
      referrer: "android-app://com.example.other/",
      search: "",
    }),
    null,
  );
  assert.equal(
    isOttlineAndroidAppReferrer("android-app://app.ottline.evil"),
    false,
  );
});

test("shows the Play CTA in Android browser and PWA without TWA context", () => {
  assert.equal(
    shouldShowAndroidPlayPrompt({
      userAgent: ANDROID_UA,
      displayMode: "browser",
      twaSignal: null,
      dismissalValue: null,
    }),
    true,
  );
  assert.equal(
    shouldShowAndroidPlayPrompt({
      userAgent: ANDROID_UA,
      displayMode: "standalone",
      twaSignal: null,
      dismissalValue: null,
    }),
    true,
  );
  assert.equal(
    shouldShowAndroidPlayPrompt({
      userAgent: ANDROID_UA,
      displayMode: "standalone",
      twaSignal: "session",
      dismissalValue: null,
    }),
    false,
  );
});

test("applies a 14-day dismissal cooldown to both prompts", () => {
  const now = Date.UTC(2026, 7, 18);
  const recent = String(now - ANDROID_ACQUISITION_COOLDOWN_MS + 1);
  const expired = String(now - ANDROID_ACQUISITION_COOLDOWN_MS);

  assert.equal(isDismissalCooldownActive(recent, now), true);
  assert.equal(isDismissalCooldownActive(expired, now), false);
  assert.equal(
    shouldShowAndroidReminderCard({
      twaSignal: "android_referrer",
      dismissalValue: recent,
      now,
    }),
    false,
  );
  assert.equal(
    shouldShowAndroidReminderCard({
      twaSignal: "android_referrer",
      dismissalValue: expired,
      now,
    }),
    true,
  );
});
