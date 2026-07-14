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
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
class AnalyticsMetricsQueryTest {

    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    private static JdbcTemplate jdbcTemplate;
    private static AnalyticsMetricsQuery metricsQuery;

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
        metricsQuery = new AnalyticsMetricsQuery(jdbcTemplate);
    }

    @BeforeEach
    void clearAnalyticsEvents() {
        jdbcTemplate.update("delete from analytics_events");
    }

    @Test
    void repeatedAppOpenInOneSessionCountsAsOneSessionAndOneClient() {
        OffsetDateTime from = kstDayStart();
        OffsetDateTime to = from.plusDays(1);
        UUID clientId = UUID.randomUUID();

        insertEvent("app_open", null, clientId, "session-1", from.plusHours(1), "web", "{}");
        insertEvent("app_open", null, clientId, "session-1", from.plusHours(2), "web", "{}");

        var summary = metricsQuery.summarize(from, to);

        assertThat(summary.activity().rawAppOpenEvents()).isEqualTo(2);
        assertThat(summary.activity().appOpenSessions()).isEqualTo(1);
        assertThat(summary.activity().activeClients()).isEqualTo(1);
        assertThat(summary.activity().qualifiedActors()).isZero();
    }

    @Test
    void oneClientAcrossTwoSessionsCountsAsTwoSessionsAndOneClient() {
        OffsetDateTime from = kstDayStart();
        UUID clientId = UUID.randomUUID();
        insertEvent("app_open", null, clientId, "session-1", from.plusHours(1), "web", "{}");
        insertEvent("app_open", null, clientId, "session-2", from.plusHours(2), "web", "{}");

        var activity = metricsQuery.summarize(from, from.plusDays(1)).activity();

        assertThat(activity.appOpenSessions()).isEqualTo(2);
        assertThat(activity.activeClients()).isEqualTo(1);
    }

    @Test
    void oneSessionSurvivesClientChurn() {
        OffsetDateTime from = kstDayStart();
        insertEvent("app_open", null, UUID.randomUUID(), "shared-session", from.plusHours(1), "web", "{}");
        insertEvent("app_open", null, UUID.randomUUID(), "shared-session", from.plusHours(2), "web", "{}");

        var activity = metricsQuery.summarize(from, from.plusDays(1)).activity();

        assertThat(activity.rawAppOpenEvents()).isEqualTo(2);
        assertThat(activity.appOpenSessions()).isEqualTo(1);
        assertThat(activity.activeClients()).isEqualTo(2);
    }

    @Test
    void anonymousSearchAndAuthenticatedLogOnOneClientResolveToOneActor() {
        OffsetDateTime from = kstDayStart();
        UUID clientId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        insertEvent("title_search", null, clientId, "session-1", from.plusHours(1), "ios_native", "{}");
        insertEvent("log_create", userId, clientId, "session-1", from.plusHours(2), "ios_native", "{}");

        var summary = metricsQuery.summarize(from, from.plusDays(1));

        assertThat(summary.activity().qualifiedActors()).isEqualTo(1);
        assertThat(summary.reach().titleSearchActors()).isEqualTo(1);
        assertThat(summary.reach().logCreateActors()).isEqualTo(1);
    }

    @Test
    void oneUserAcrossMultipleClientsCountsAsOneQualifiedActor() {
        OffsetDateTime from = kstDayStart();
        UUID userId = UUID.randomUUID();
        insertEvent("title_search", userId, UUID.randomUUID(), "session-1", from.plusHours(1), "web", "{}");
        insertEvent("title_select", userId, UUID.randomUUID(), "session-2", from.plusHours(2), "ios_native", "{}");

        var summary = metricsQuery.summarize(from, from.plusDays(1));

        assertThat(summary.activity().qualifiedActors()).isEqualTo(1);
        assertThat(summary.reach().titleSearchActors()).isEqualTo(1);
        assertThat(summary.reach().titleSelectActors()).isEqualTo(1);
    }

    @Test
    void clientMappedToMultipleUsersDoesNotAttachAnonymousBehaviorToEitherUser() {
        OffsetDateTime from = kstDayStart();
        UUID clientId = UUID.randomUUID();
        UUID firstUser = UUID.randomUUID();
        UUID secondUser = UUID.randomUUID();
        insertEvent("identity_link", firstUser, clientId, "identity-1", from.minusHours(2), "web", "{}");
        insertEvent("identity_link", secondUser, clientId, "identity-2", from.minusHours(1), "web", "{}");
        insertEvent("title_search", null, clientId, "session-1", from.plusHours(1), "web", "{}");
        insertEvent("title_select", firstUser, clientId, "session-1", from.plusHours(2), "web", "{}");

        var summary = metricsQuery.summarize(from, from.plusDays(1));

        assertThat(summary.activity().qualifiedActors()).isEqualTo(2);
    }

    @Test
    void appOpenAndImpressionAloneDoNotQualifyAnActor() {
        OffsetDateTime from = kstDayStart();
        UUID clientId = UUID.randomUUID();
        insertEvent("app_open", null, clientId, "session-1", from.plusHours(1), "web", "{}");
        insertEvent("activation_impression", null, clientId, "session-1", from.plusHours(2), "web", "{}");

        var summary = metricsQuery.summarize(from, from.plusDays(1));

        assertThat(summary.activity().qualifiedActors()).isZero();
        assertThat(summary.reach()).isEqualTo(new com.watchlog.api.dto.AdminReachSummaryDto(0, 0, 0, 0, 0));
    }

    @Test
    void titleSelectionWithoutSearchIsIndependentReach() {
        OffsetDateTime from = kstDayStart();
        insertEvent("title_select", null, UUID.randomUUID(), "session-1", from.plusHours(1), "web", "{}");

        var summary = metricsQuery.summarize(from, from.plusDays(1));

        assertThat(summary.reach().titleSearchActors()).isZero();
        assertThat(summary.reach().titleSelectActors()).isEqualTo(1);
        assertThat(summary.activity().qualifiedActors()).isEqualTo(1);
    }

    @Test
    void clientlessLegacyEventsUseSessionAsActorAndSessionKey() {
        OffsetDateTime from = kstDayStart();
        insertEvent("app_open", null, null, "legacy-session", from.plusHours(1), "web", "{}");
        insertEvent("title_select", null, null, "legacy-session", from.plusHours(2), "web", "{}");

        var summary = metricsQuery.summarize(from, from.plusDays(1));

        assertThat(summary.activity().appOpenSessions()).isEqualTo(1);
        assertThat(summary.activity().activeClients()).isZero();
        assertThat(summary.activity().qualifiedActors()).isEqualTo(1);
    }

    @Test
    void blankLegacySessionsFallbackToResolvedActor() {
        OffsetDateTime from = kstDayStart();
        UUID clientId = UUID.randomUUID();
        insertEvent("app_open", null, clientId, " ", from.plusHours(1), "web", "{}");
        insertEvent("app_open", null, clientId, "", from.plusHours(2), "web", "{}");

        var activity = metricsQuery.summarize(from, from.plusDays(1)).activity();

        assertThat(activity.rawAppOpenEvents()).isEqualTo(2);
        assertThat(activity.appOpenSessions()).isEqualTo(1);
    }

    @Test
    void timeRangeIsClosedOpenAndExcludesFutureEvents() {
        OffsetDateTime from = kstDayStart();
        OffsetDateTime to = from.plusDays(1);
        UUID clientId = UUID.randomUUID();
        insertEvent("app_open", null, clientId, "before", from.minusSeconds(1), "web", "{}");
        insertEvent("app_open", null, clientId, "at-from", from, "web", "{}");
        insertEvent("app_open", null, clientId, "before-to", to.minusSeconds(1), "web", "{}");
        insertEvent("app_open", null, clientId, "at-to", to, "web", "{}");
        insertEvent("app_open", null, clientId, "future", to.plusDays(10), "web", "{}");

        var activity = metricsQuery.summarize(from, to).activity();

        assertThat(activity.rawAppOpenEvents()).isEqualTo(2);
        assertThat(activity.appOpenSessions()).isEqualTo(2);
    }

    @Test
    void dailySummaryUsesKstMidnightBoundary() {
        OffsetDateTime from = OffsetDateTime.of(2026, 7, 13, 0, 0, 0, 0, ZoneOffset.ofHours(9));
        OffsetDateTime to = from.plusDays(2);
        insertEvent("app_open", null, UUID.randomUUID(), "before-midnight",
                OffsetDateTime.parse("2026-07-13T14:59:59Z"), "web", "{}");
        insertEvent("app_open", null, UUID.randomUUID(), "after-midnight",
                OffsetDateTime.parse("2026-07-13T15:00:00Z"), "web", "{}");

        List<AnalyticsMetricsQuery.DailySummary> daily = metricsQuery.summarizeDaily(from, to);

        assertThat(daily).extracting(AnalyticsMetricsQuery.DailySummary::day)
                .containsExactly(LocalDate.of(2026, 7, 14), LocalDate.of(2026, 7, 13));
        assertThat(daily).allSatisfy(row -> assertThat(row.activity().appOpenSessions()).isEqualTo(1));
    }

    @Test
    void uniquelyMappedAdminClientIsExcludedAfterActorResolution() {
        OffsetDateTime from = kstDayStart();
        UUID adminId = UUID.fromString(AnalyticsMetricsQuery.EXCLUDED_ADMIN_ID);
        UUID clientId = UUID.randomUUID();
        insertEvent("identity_link", adminId, clientId, "identity", from.minusHours(1), "web", "{}");
        insertEvent("app_open", null, clientId, "session-1", from.plusHours(1), "web", "{}");
        insertEvent("title_search", null, clientId, "session-1", from.plusHours(2), "web", "{}");
        insertEvent("log_create", adminId, clientId, "session-1", from.plusHours(3), "web", "{}");

        var summary = metricsQuery.summarize(from, from.plusDays(1));

        assertThat(summary.activity()).isEqualTo(new com.watchlog.api.dto.AdminActivityWindowDto(0, 0, 0, 0));
        assertThat(summary.reach()).isEqualTo(new com.watchlog.api.dto.AdminReachSummaryDto(0, 0, 0, 0, 0));
    }

    @Test
    void osFamilyDimensionMergesHistoricalAndNormalizedIosKeys() {
        OffsetDateTime from = kstDayStart();
        insertEvent("app_open", null, UUID.randomUUID(), "session-1", from.plusHours(1), "ios_native", "{\"osFamily\":\"iOS\"}");
        insertEvent("app_open", null, UUID.randomUUID(), "session-2", from.plusHours(2), "ios_native", "{\"osFamily\":\"ios\"}");

        var dimensions = metricsQuery.summarizeAppOpenDimension("osFamily", from, from.plusDays(1));

        assertThat(dimensions).singleElement().satisfies(dimension -> {
            assertThat(dimension.key()).isEqualTo("ios");
            assertThat(dimension.events()).isEqualTo(2);
            assertThat(dimension.appOpenSessions()).isEqualTo(2);
            assertThat(dimension.activeClients()).isEqualTo(2);
        });
    }

    @Test
    void eventBreakdownUsesResolvedActors() {
        OffsetDateTime from = kstDayStart();
        UUID clientId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        insertEvent("title_search", null, clientId, "session-1", from.plusHours(1), "ios_native", "{}");
        insertEvent("title_search", userId, clientId, "session-1", from.plusHours(2), "ios_native", "{}");

        var breakdown = metricsQuery.summarizeEventBreakdown(from, from.plusDays(1));

        assertThat(breakdown).singleElement().satisfies(row -> {
            assertThat(row.eventName()).isEqualTo("title_search");
            assertThat(row.events()).isEqualTo(2);
            assertThat(row.actors()).isEqualTo(1);
        });
    }

    @Test
    void calendarWindowsUseTodayAndPreviousKstCalendarDays() {
        OffsetDateTime utcNow = OffsetDateTime.parse("2026-07-14T16:30:00Z");

        var windows = metricsQuery.calendarWindows(7, utcNow);

        assertThat(windows.days()).isEqualTo(7);
        assertThat(windows.to()).isEqualTo(OffsetDateTime.parse("2026-07-15T01:30:00+09:00"));
        assertThat(windows.todayFrom()).isEqualTo(OffsetDateTime.parse("2026-07-15T00:00:00+09:00"));
        assertThat(windows.periodFrom()).isEqualTo(OffsetDateTime.parse("2026-07-09T00:00:00+09:00"));
        assertThat(windows.last7DaysFrom()).isEqualTo(windows.periodFrom());
        assertThat(windows.last30DaysFrom()).isEqualTo(OffsetDateTime.parse("2026-06-16T00:00:00+09:00"));
    }

    private OffsetDateTime kstDayStart() {
        return OffsetDateTime.of(2026, 7, 14, 0, 0, 0, 0, ZoneOffset.ofHours(9));
    }

    private void insertEvent(
            String eventName,
            UUID userId,
            UUID clientId,
            String sessionId,
            OffsetDateTime occurredAt,
            String platform,
            String properties
    ) {
        if (userId != null) {
            jdbcTemplate.update("""
                    insert into users (id, pairing_code, created_at)
                    values (?, ?, ?)
                    on conflict (id) do nothing
                    """, userId, userId.toString().replace("-", "").substring(0, 16), occurredAt.minusDays(1));
        }
        jdbcTemplate.update("""
                insert into analytics_events (
                    event_id, user_id, client_id, session_id, event_name,
                    platform, client_version, properties, occurred_at, created_at
                ) values (?, ?, ?, ?, ?, ?, 'test', cast(? as jsonb), ?, ?)
                """,
                UUID.randomUUID(), userId, clientId, sessionId, eventName,
                platform, properties, occurredAt, occurredAt
        );
    }
}
