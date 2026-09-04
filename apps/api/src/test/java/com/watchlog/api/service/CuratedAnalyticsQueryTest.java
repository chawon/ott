package com.watchlog.api.service;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
class CuratedAnalyticsQueryTest {

    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    private static JdbcTemplate jdbcTemplate;
    private static CuratedAnalyticsQuery query;

    @BeforeAll
    static void setUpDatabase() {
        var dataSource = new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(),
                POSTGRES.getUsername(),
                POSTGRES.getPassword()
        );
        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .load()
                .migrate();
        jdbcTemplate = new JdbcTemplate(dataSource);
        query = new CuratedAnalyticsQuery(jdbcTemplate);
    }

    @BeforeEach
    void clearEvents() {
        jdbcTemplate.update("delete from analytics_events");
    }

    @Test
    void summarizesCuratorImpressionsOpensAndHumanActionsSeparately() {
        OffsetDateTime from = OffsetDateTime.of(2026, 9, 4, 0, 0, 0, 0, ZoneOffset.ofHours(9));
        UUID clientId = UUID.randomUUID();
        insertEvent("curated_impression", clientId, "curator-session", from.plusHours(1));
        insertEvent("curated_open", clientId, "curator-session", from.plusHours(2));
        insertEvent("curated_human_action", clientId, "curator-session", from.plusHours(3));
        insertEvent("curated_human_action", clientId, "curator-session", from.plusHours(4));

        var summary = query.summarize(from, from.plusDays(1));

        assertThat(summary.impressions()).isEqualTo(1);
        assertThat(summary.opens()).isEqualTo(1);
        assertThat(summary.humanActions()).isEqualTo(2);
        assertThat(summary.humanActionActors()).isEqualTo(1);
    }

    private void insertEvent(String eventName, UUID clientId, String sessionId, OffsetDateTime occurredAt) {
        jdbcTemplate.update("""
                insert into analytics_events (
                    event_id, client_id, session_id, event_name, platform,
                    client_version, properties, occurred_at, created_at
                ) values (?, ?, ?, ?, 'web', 'test', '{}'::jsonb, ?, ?)
                """, UUID.randomUUID(), clientId, sessionId, eventName, occurredAt, occurredAt);
    }
}
