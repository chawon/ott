package com.watchlog.api.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;

@Component
public class CuratedAnalyticsQuery {

    private static final String CURATED_EVENTS_CTE = """
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
                  and e.event_name in ('curated_impression', 'curated_open', 'curated_human_action')
            ),
            base as (
                select *
                from resolved
                where actor_key is distinct from ?
            )
            """;

    private final JdbcTemplate jdbcTemplate;

    public CuratedAnalyticsQuery(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Summary summarize(OffsetDateTime from, OffsetDateTime to) {
        return jdbcTemplate.queryForObject(
                CURATED_EVENTS_CTE + """
                        select
                            count(*) filter (where event_name = 'curated_impression') as impressions,
                            count(*) filter (where event_name = 'curated_open') as opens,
                            count(*) filter (where event_name = 'curated_human_action') as human_actions,
                            count(distinct actor_key) filter (where event_name = 'curated_human_action') as human_action_actors
                        from base
                        """,
                (rs, rowNum) -> new Summary(
                        rs.getLong("impressions"),
                        rs.getLong("opens"),
                        rs.getLong("human_actions"),
                        rs.getLong("human_action_actors")
                ),
                to,
                from,
                to,
                AnalyticsMetricsQuery.EXCLUDED_ADMIN_ACTOR
        );
    }

    public record Summary(long impressions, long opens, long humanActions, long humanActionActors) {}
}
