package com.watchlog.api.service;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CloudflareAnalyticsServiceTest {

    private final CloudflareAnalyticsService service = new CloudflareAnalyticsService();

    @Test
    void convertsAKstCalendarDayToAnExactUtcRange() {
        var range = CloudflareAnalyticsService.kstDayRange(LocalDate.of(2026, 8, 2));

        assertThat(range.start()).isEqualTo(Instant.parse("2026-08-01T15:00:00Z"));
        assertThat(range.end()).isEqualTo(Instant.parse("2026-08-02T15:00:00Z"));
    }

    @Test
    void queriesHourlyTrafficAndRumWithTheSameTimeRange() {
        assertThat(CloudflareAnalyticsService.DAILY_QUERY)
                .contains(
                        "httpRequests1hGroups(",
                        "rumPageloadEventsAdaptiveGroups(",
                        "datetime_geq: $start",
                        "datetime_lt: $end"
                )
                .doesNotContain("httpRequests1dGroups(", "filter: {date:");
    }

    @Test
    void sumsEveryReturnedTrafficAndRumGroup() {
        Map<String, Object> response = Map.of(
                "data", Map.of(
                        "viewer", Map.of(
                                "zones", List.of(Map.of(
                                        "httpRequests1hGroups", List.of(
                                                group(Map.of("requests", 10, "pageViews", 4)),
                                                group(Map.of("requests", 7, "pageViews", 3))
                                        )
                                )),
                                "accounts", List.of(Map.of(
                                        "rumPageloadEventsAdaptiveGroups", List.of(
                                                group(Map.of("visits", 2)),
                                                group(Map.of("visits", 5))
                                        )
                                ))
                        )
                )
        );

        var result = service.parseResponse(response);

        assertThat(result.requests()).isEqualTo(17);
        assertThat(result.pageViews()).isEqualTo(7);
        assertThat(result.visits()).isEqualTo(7);
        assertThat(result.uniqueVisitors()).isEqualTo(7);
        assertThat(result.error()).isNull();
    }

    private static Map<String, Object> group(Map<String, Object> sum) {
        return Map.of("sum", sum);
    }
}
