package com.watchlog.api.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AnalyticsRetentionServiceTest {

    @Test
    void deletesEventsStrictlyOlderThanOneHundredEightyDays() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.update(anyString(), any(OffsetDateTime.class))).thenReturn(3);
        AnalyticsRetentionService service = new AnalyticsRetentionService(jdbcTemplate);
        OffsetDateTime now = OffsetDateTime.parse("2026-07-19T03:30:00Z");

        int deleted = service.purgeExpiredEvents(now);

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<OffsetDateTime> cutoffCaptor = ArgumentCaptor.forClass(OffsetDateTime.class);
        verify(jdbcTemplate).update(sqlCaptor.capture(), cutoffCaptor.capture());
        assertThat(sqlCaptor.getValue()).contains("created_at < ?");
        assertThat(cutoffCaptor.getValue()).isEqualTo(now.minusDays(180));
        assertThat(deleted).isEqualTo(3);
    }
}
