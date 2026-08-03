package com.watchlog.api.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class AnalyticsSeasonalRecapWindowTest {

    @Test
    void exposesTheFirstHalfRecapOnlyDuringJuly() {
        assertThat(AnalyticsService.isH1RecapVisible(LocalDate.of(2026, 6, 30))).isFalse();
        assertThat(AnalyticsService.isH1RecapVisible(LocalDate.of(2026, 7, 1))).isTrue();
        assertThat(AnalyticsService.isH1RecapVisible(LocalDate.of(2026, 7, 31))).isTrue();
        assertThat(AnalyticsService.isH1RecapVisible(LocalDate.of(2026, 8, 1))).isFalse();
    }
}
