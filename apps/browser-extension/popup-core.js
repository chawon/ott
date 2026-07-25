(function initializeOttlineExtension(root) {
  const PLATFORM_KEYS = Object.freeze({
    netflix: "netflix",
    disneyplus: "disney",
    tving: "tving",
    wavve: "wavve",
    coupangplay: "coupang",
    watcha: "watcha",
  });

  const PLATFORM_MESSAGE_KEYS = Object.freeze({
    netflix: "platformNetflix",
    disneyplus: "platformDisney",
    tving: "platformTving",
    wavve: "platformWavve",
    coupangplay: "platformCoupang",
    watcha: "platformWatcha",
  });

  function normalizeLocale(locale) {
    return /^ko(?:[-_]|$)/i.test(locale ?? "") ? "ko" : "en";
  }

  function appBaseUrl(locale) {
    return normalizeLocale(locale) === "ko"
      ? "https://ottline.app/"
      : "https://ottline.app/en";
  }

  function platformKeyForSourceSite(sourceSite) {
    return PLATFORM_KEYS[sourceSite] ?? "";
  }

  function platformMessageKeyForSourceSite(sourceSite) {
    return PLATFORM_MESSAGE_KEYS[sourceSite] ?? "";
  }

  function buildTargetUrl(payload, locale) {
    const target = new URL(appBaseUrl(locale));
    target.searchParams.set("quick", "1");
    target.searchParams.set("quick_focus", "1");
    target.searchParams.set("capture_title", payload.title);
    target.searchParams.set("capture_type", payload.contentType ?? "video");

    const platformKey =
      payload.platformKey || platformKeyForSourceSite(payload.sourceSite);
    if (platformKey) {
      target.searchParams.set("capture_platform_key", platformKey);
    }
    if (payload.platform) {
      target.searchParams.set("capture_platform", payload.platform);
    }
    if (payload.sourceSite) {
      target.searchParams.set("capture_source_site", payload.sourceSite);
    }
    if (payload.sourceUrl) {
      target.searchParams.set("capture_source_url", payload.sourceUrl);
    }

    return target.toString();
  }

  root.OttlineExtension = Object.freeze({
    appBaseUrl,
    buildTargetUrl,
    normalizeLocale,
    platformKeyForSourceSite,
    platformMessageKeyForSourceSite,
  });
})(globalThis);
