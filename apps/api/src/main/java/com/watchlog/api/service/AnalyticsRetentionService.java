package com.watchlog.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Objects;

@Service
public class AnalyticsRetentionService {

    static final int RETENTION_DAYS = 180;
    private static final Logger log = LoggerFactory.getLogger(AnalyticsRetentionService.class);

    private final JdbcTemplate jdbcTemplate;

    public AnalyticsRetentionService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Scheduled(
            cron = "${analytics.retention.schedule:0 30 3 * * *}",
            zone = "Asia/Seoul"
    )
    @Transactional
    public void scheduledCleanup() {
        int deleted = purgeExpiredEvents(OffsetDateTime.now(ZoneOffset.UTC));
        if (deleted > 0) {
            log.info("Deleted {} analytics events older than {} days", deleted, RETENTION_DAYS);
        }
    }

    int purgeExpiredEvents(OffsetDateTime now) {
        Objects.requireNonNull(now, "now is required");
        OffsetDateTime cutoff = now.minusDays(RETENTION_DAYS);
        return jdbcTemplate.update(
                "delete from analytics_events where created_at < ?",
                cutoff
        );
    }
}
