package com.watchlog.api.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AcquisitionAttributionTest {

    @Test
    void attributionUsesUtmThenOwnedEntrySourceThenExternalReferrer() {
        assertThat(AcquisitionAnalyticsQuery.classifyAttribution(
                "Google Ads", "cpc", "android-watch-reminder", "https://chatgpt.com"
        )).isEqualTo(new AcquisitionAnalyticsQuery.Attribution("paid_search", "google"));

        assertThat(AcquisitionAnalyticsQuery.classifyAttribution(
                null, null, "ANDROID-REVISIT-REMINDER", "https://www.google.com"
        )).isEqualTo(new AcquisitionAnalyticsQuery.Attribution(
                "owned_reengagement", "android-revisit-reminder"
        ));

        assertThat(AcquisitionAnalyticsQuery.classifyAttribution(
                null, null, null, "https://www.google.co.kr"
        )).isEqualTo(new AcquisitionAnalyticsQuery.Attribution("organic_search", "google"));
    }

    @Test
    void attributionNormalizesAiSocialStoreSelfAndUnknownReferrers() {
        assertThat(AcquisitionAnalyticsQuery.classifyAttribution(
                null, null, null, "https://chat.openai.com"
        )).isEqualTo(new AcquisitionAnalyticsQuery.Attribution("ai_referral", "chatgpt"));
        assertThat(AcquisitionAnalyticsQuery.classifyAttribution(
                null, null, null, "https://t.co"
        )).isEqualTo(new AcquisitionAnalyticsQuery.Attribution("social", "x"));
        assertThat(AcquisitionAnalyticsQuery.classifyAttribution(
                null, null, null, "https://store.whale.naver.com"
        )).isEqualTo(new AcquisitionAnalyticsQuery.Attribution("store_referral", "whale_store"));
        assertThat(AcquisitionAnalyticsQuery.classifyAttribution(
                null, null, null, "https://ottline.app"
        )).isEqualTo(new AcquisitionAnalyticsQuery.Attribution("direct", "direct"));
        assertThat(AcquisitionAnalyticsQuery.classifyAttribution(
                null, null, null, "not a url"
        )).isEqualTo(new AcquisitionAnalyticsQuery.Attribution("unknown", "unknown"));
    }

    @Test
    void arbitraryEntrySourceIsIgnored() {
        assertThat(AcquisitionAnalyticsQuery.classifyAttribution(
                null, null, "user@example.com", "direct"
        )).isEqualTo(new AcquisitionAnalyticsQuery.Attribution("direct", "direct"));
    }
}
