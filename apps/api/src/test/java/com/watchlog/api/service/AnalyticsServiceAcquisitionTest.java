package com.watchlog.api.service;

import com.watchlog.api.repo.UserRepository;
import com.watchlog.api.repo.WatchLogRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AnalyticsServiceAcquisitionTest {

    @Test
    void acquisitionUsesTheDedicatedOneHundredEightyDayWindow() {
        AnalyticsMetricsQuery metricsQuery = mock(AnalyticsMetricsQuery.class);
        AcquisitionAnalyticsQuery acquisitionQuery = mock(AcquisitionAnalyticsQuery.class);
        OffsetDateTime from = OffsetDateTime.parse("2026-01-22T00:00:00+09:00");
        OffsetDateTime to = OffsetDateTime.parse("2026-07-20T00:00:00+09:00");
        var windows = new AnalyticsMetricsQuery.CalendarWindows(
                180,
                from,
                to.minusDays(1),
                to.minusDays(7),
                to.minusDays(30),
                to
        );
        var emptyMetrics = new AcquisitionAnalyticsQuery.Metrics(0, 0, 0, 0);
        var emptyResult = new AcquisitionAnalyticsQuery.Result(
                emptyMetrics,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                0
        );
        when(metricsQuery.acquisitionCalendarWindows(eq(180), any())).thenReturn(windows);
        when(acquisitionQuery.summarize(from, to)).thenReturn(emptyResult);
        AnalyticsService service = new AnalyticsService(
                mock(JdbcTemplate.class),
                metricsQuery,
                acquisitionQuery,
                mock(WatchLogRepository.class),
                mock(UserRepository.class),
                "admin-secret"
        );

        var result = service.adminAcquisition("admin-secret", 180);

        assertThat(result.days()).isEqualTo(180);
        assertThat(result.from()).isEqualTo(from);
        assertThat(result.to()).isEqualTo(to);
        verify(metricsQuery).acquisitionCalendarWindows(eq(180), any());
        verify(metricsQuery, never()).calendarWindows(eq(180), any());
    }
}
