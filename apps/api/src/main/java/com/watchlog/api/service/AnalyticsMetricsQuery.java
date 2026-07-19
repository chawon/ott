package com.watchlog.api.service;

import com.watchlog.api.dto.AdminActivityWindowDto;
import com.watchlog.api.dto.AdminReachSummaryDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;

/**
 * PostgreSQL-backed analytics aggregation with one actor-resolution policy.
 * Callers provide closed-open time ranges and consume behavior-oriented results;
 * identity stitching and SQL details stay inside this module.
 */
@Component
public class AnalyticsMetricsQuery {

    static final String EXCLUDED_ADMIN_ID = "2777a431-5ccb-4761-9c8a-2b17a34ff566";
    private static final String EXCLUDED_ADMIN_ACTOR = "u:" + EXCLUDED_ADMIN_ID;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private static final String RESOLVED_EVENTS_CTE = """
            with client_identity as (
                select
                    client_id,
                    case
                        when count(distinct user_id) = 1 then min(user_id::text)
                        else null
                    end as mapped_user_id
                from analytics_events
                where client_id is not null
                  and user_id is not null
                  and occurred_at < ?
                group by client_id
            ),
            resolved as (
                select
                    e.*,
                    case
                        when e.user_id is not null then 'u:' || e.user_id::text
                        when ci.mapped_user_id is not null then 'u:' || ci.mapped_user_id
                        when e.client_id is not null then 'c:' || e.client_id::text
                        when nullif(btrim(e.session_id), '') is not null then 's:' || btrim(e.session_id)
                        else null
                    end as actor_key
                from analytics_events e
                left join client_identity ci on ci.client_id = e.client_id
                where e.occurred_at >= ?
                  and e.occurred_at < ?
            ),
            base as (
                select
                    resolved.*,
                    case
                        when nullif(btrim(session_id), '') is not null then 'sess:' || btrim(session_id)
                        when actor_key is not null then 'actor:' || actor_key
                        else null
                    end as app_open_session_key
                from resolved
                where actor_key is distinct from ?
            )
            """;

    private static final String ACTIVITY_AND_REACH_SELECT = """
            select
                count(*) as events,
                count(*) filter (where event_name = 'app_open') as raw_app_open_events,
                count(distinct app_open_session_key) filter (where event_name = 'app_open') as app_open_sessions,
                count(distinct client_id) filter (where event_name = 'app_open') as active_clients,
                count(distinct actor_key) filter (where event_name = 'app_open') as app_open_actors,
                count(distinct actor_key) filter (where event_name in (
                    'title_search', 'title_select', 'login_success', 'first_log_create', 'log_create'
                )) as qualified_actors,
                count(distinct actor_key) filter (where event_name = 'title_search') as title_search_actors,
                count(distinct actor_key) filter (where event_name = 'title_select') as title_select_actors,
                count(distinct actor_key) filter (where event_name = 'login_success') as login_actors,
                count(distinct actor_key) filter (where event_name = 'first_log_create') as first_log_create_actors,
                count(distinct actor_key) filter (where event_name = 'log_create') as log_create_actors
            from base
            """;

    private final JdbcTemplate jdbcTemplate;

    public AnalyticsMetricsQuery(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public PeriodSummary summarize(OffsetDateTime from, OffsetDateTime to) {
        validateRange(from, to);
        return jdbcTemplate.queryForObject(
                RESOLVED_EVENTS_CTE + ACTIVITY_AND_REACH_SELECT,
                (rs, rowNum) -> new PeriodSummary(
                        rs.getLong("events"),
                        rs.getLong("app_open_actors"),
                        new AdminActivityWindowDto(
                                rs.getLong("raw_app_open_events"),
                                rs.getLong("app_open_sessions"),
                                rs.getLong("active_clients"),
                                rs.getLong("qualified_actors")
                        ),
                        new AdminReachSummaryDto(
                                rs.getLong("title_search_actors"),
                                rs.getLong("title_select_actors"),
                                rs.getLong("login_actors"),
                                rs.getLong("first_log_create_actors"),
                                rs.getLong("log_create_actors")
                        )
                ),
                to,
                from,
                to,
                EXCLUDED_ADMIN_ACTOR
        );
    }

    public List<DailySummary> summarizeDaily(OffsetDateTime from, OffsetDateTime to) {
        validateRange(from, to);
        return jdbcTemplate.query(
                RESOLVED_EVENTS_CTE + """
                        select
                            (occurred_at at time zone 'Asia/Seoul')::date as day,
                            count(*) as events,
                            count(*) filter (where event_name = 'app_open') as raw_app_open_events,
                            count(distinct app_open_session_key) filter (where event_name = 'app_open') as app_open_sessions,
                            count(distinct client_id) filter (where event_name = 'app_open') as active_clients,
                            count(distinct actor_key) filter (where event_name = 'app_open') as app_open_actors,
                            count(distinct actor_key) filter (where event_name in (
                                'title_search', 'title_select', 'login_success', 'first_log_create', 'log_create'
                            )) as qualified_actors,
                            count(distinct actor_key) filter (where event_name = 'title_search') as title_search_actors,
                            count(distinct actor_key) filter (where event_name = 'title_select') as title_select_actors,
                            count(distinct actor_key) filter (where event_name = 'login_success') as login_actors,
                            count(distinct actor_key) filter (where event_name = 'first_log_create') as first_log_create_actors,
                            count(distinct actor_key) filter (where event_name = 'log_create') as log_create_actors
                        from base
                        group by 1
                        order by 1 desc
                        """,
                (rs, rowNum) -> new DailySummary(
                        rs.getObject("day", LocalDate.class),
                        rs.getLong("events"),
                        rs.getLong("app_open_actors"),
                        new AdminActivityWindowDto(
                                rs.getLong("raw_app_open_events"),
                                rs.getLong("app_open_sessions"),
                                rs.getLong("active_clients"),
                                rs.getLong("qualified_actors")
                        ),
                        new AdminReachSummaryDto(
                                rs.getLong("title_search_actors"),
                                rs.getLong("title_select_actors"),
                                rs.getLong("login_actors"),
                                rs.getLong("first_log_create_actors"),
                                rs.getLong("log_create_actors")
                        )
                ),
                to,
                from,
                to,
                EXCLUDED_ADMIN_ACTOR
        );
    }

    public List<PlatformSummary> summarizePlatforms(OffsetDateTime from, OffsetDateTime to) {
        validateRange(from, to);
        return jdbcTemplate.query(
                RESOLVED_EVENTS_CTE + """
                        select
                            platform,
                            count(*) as events,
                            count(distinct actor_key)
                                filter (where event_name = 'app_open') as active_users,
                            count(*) filter (where event_name = 'app_open') as raw_app_open_events,
                            count(distinct app_open_session_key) filter (where event_name = 'app_open') as app_open_sessions,
                            count(distinct client_id) filter (where event_name = 'app_open') as active_clients,
                            count(distinct actor_key) filter (where event_name in (
                                'title_search', 'title_select', 'login_success', 'first_log_create', 'log_create'
                            )) as qualified_actors
                        from base
                        group by platform
                        order by platform asc
                        """,
                (rs, rowNum) -> new PlatformSummary(
                        rs.getString("platform"),
                        rs.getLong("events"),
                        rs.getLong("active_users"),
                        rs.getLong("raw_app_open_events"),
                        rs.getLong("app_open_sessions"),
                        rs.getLong("active_clients"),
                        rs.getLong("qualified_actors")
                ),
                to,
                from,
                to,
                EXCLUDED_ADMIN_ACTOR
        );
    }

    public List<DimensionSummary> summarizeAppOpenDimension(
            String propertyKey,
            OffsetDateTime from,
            OffsetDateTime to
    ) {
        return summarizeAppOpenDimension(propertyKey, from, to, null, false);
    }

    public List<DimensionSummary> summarizePlatformAppOpenDimension(
            String platform,
            String propertyKey,
            OffsetDateTime from,
            OffsetDateTime to
    ) {
        return summarizeAppOpenDimension(propertyKey, from, to, platform, false);
    }

    public List<DimensionSummary> summarizeAndroidAppOpenDimension(
            String propertyKey,
            OffsetDateTime from,
            OffsetDateTime to
    ) {
        return summarizeAppOpenDimension(propertyKey, from, to, null, true);
    }

    public List<EventBreakdownSummary> summarizeEventBreakdown(OffsetDateTime from, OffsetDateTime to) {
        validateRange(from, to);
        return jdbcTemplate.query(
                RESOLVED_EVENTS_CTE + """
                        select
                            event_name,
                            count(*) as events,
                            count(distinct actor_key) as actors
                        from base
                        group by event_name
                        order by events desc, event_name asc
                        """,
                (rs, rowNum) -> new EventBreakdownSummary(
                        rs.getString("event_name"),
                        rs.getLong("events"),
                        rs.getLong("actors")
                ),
                to,
                from,
                to,
                EXCLUDED_ADMIN_ACTOR
        );
    }

    public CalendarWindows calendarWindows(int days, OffsetDateTime now) {
        return calendarWindows(days, 90, now);
    }

    public CalendarWindows acquisitionCalendarWindows(int days, OffsetDateTime now) {
        return calendarWindows(days, 180, now);
    }

    private CalendarWindows calendarWindows(int days, int maximumDays, OffsetDateTime now) {
        Objects.requireNonNull(now, "now is required");
        int safeDays = Math.max(1, Math.min(days, maximumDays));
        OffsetDateTime to = now.atZoneSameInstant(KST).toOffsetDateTime();
        LocalDate today = to.toLocalDate();
        OffsetDateTime todayFrom = today.atStartOfDay(KST).toOffsetDateTime();
        return new CalendarWindows(
                safeDays,
                today.minusDays(safeDays - 1L).atStartOfDay(KST).toOffsetDateTime(),
                todayFrom,
                today.minusDays(6).atStartOfDay(KST).toOffsetDateTime(),
                today.minusDays(29).atStartOfDay(KST).toOffsetDateTime(),
                to
        );
    }

    private List<DimensionSummary> summarizeAppOpenDimension(
            String propertyKey,
            OffsetDateTime from,
            OffsetDateTime to,
            String platform,
            boolean androidOnly
    ) {
        validateRange(from, to);
        if (propertyKey == null || propertyKey.isBlank()) {
            throw new IllegalArgumentException("propertyKey is required");
        }

        String dimensionExpression = "osFamily".equals(propertyKey)
                ? "lower(nullif(properties->>?, ''))"
                : "nullif(properties->>?, '')";
        String platformFilter = platform == null ? "" : " and platform = ?\n";
        String androidFilter = androidOnly ? """
                  and (
                    platform = 'twa'
                    or properties->>'androidAppVersion' is not null
                    or properties->>'androidTwaSignal' is not null
                  )
                """ : "";

        String sql = RESOLVED_EVENTS_CTE + """
                select
                    coalesce(%s, 'unknown') as dim_key,
                    count(*) as events,
                    count(distinct actor_key) as active_users,
                    count(distinct app_open_session_key) as app_open_sessions,
                    count(distinct client_id) as active_clients
                from base
                where event_name = 'app_open'
                %s%s
                group by 1
                order by events desc, dim_key asc
                """.formatted(dimensionExpression, platformFilter, androidFilter);

        List<Object> args = new java.util.ArrayList<>(List.of(
                to, from, to, EXCLUDED_ADMIN_ACTOR, propertyKey
        ));
        if (platform != null) args.add(platform);

        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new DimensionSummary(
                        rs.getString("dim_key"),
                        rs.getLong("events"),
                        rs.getLong("active_users"),
                        rs.getLong("app_open_sessions"),
                        rs.getLong("active_clients")
                ),
                args.toArray()
        );
    }

    private void validateRange(OffsetDateTime from, OffsetDateTime to) {
        Objects.requireNonNull(from, "from is required");
        Objects.requireNonNull(to, "to is required");
        if (!from.isBefore(to)) {
            throw new IllegalArgumentException("from must be before to");
        }
    }

    public record PeriodSummary(
            long events,
            long appOpenActors,
            AdminActivityWindowDto activity,
            AdminReachSummaryDto reach
    ) {}

    public record DailySummary(
            LocalDate day,
            long events,
            long appOpenActors,
            AdminActivityWindowDto activity,
            AdminReachSummaryDto reach
    ) {}

    public record PlatformSummary(
            String platform,
            long events,
            long activeUsers,
            long rawAppOpenEvents,
            long appOpenSessions,
            long activeClients,
            long qualifiedActors
    ) {}

    public record DimensionSummary(
            String key,
            long events,
            long activeUsers,
            long appOpenSessions,
            long activeClients
    ) {}

    public record EventBreakdownSummary(
            String eventName,
            long events,
            long actors
    ) {}

    public record CalendarWindows(
            int days,
            OffsetDateTime periodFrom,
            OffsetDateTime todayFrom,
            OffsetDateTime last7DaysFrom,
            OffsetDateTime last30DaysFrom,
            OffsetDateTime to
    ) {}
}
