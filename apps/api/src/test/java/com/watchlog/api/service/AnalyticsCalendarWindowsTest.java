package com.watchlog.api.service;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class AnalyticsCalendarWindowsTest {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private final AnalyticsMetricsQuery query = new AnalyticsMetricsQuery(mock(JdbcTemplate.class));

    @Test
    void acquisitionWindowSupportsOneHundredEightyCalendarDays() {
        OffsetDateTime now = OffsetDateTime.parse("2026-07-19T05:30:00Z");

        var windows = query.acquisitionCalendarWindows(180, now);

        assertThat(windows.days()).isEqualTo(180);
        assertThat(windows.periodFrom()).isEqualTo(
                windows.to().toLocalDate().minusDays(179).atStartOfDay(KST).toOffsetDateTime()
        );
    }

    @Test
    void generalAnalyticsWindowKeepsItsNinetyDayLimit() {
        OffsetDateTime now = OffsetDateTime.parse("2026-07-19T05:30:00Z");

        assertThat(query.calendarWindows(180, now).days()).isEqualTo(90);
    }
}
