package com.watchlog.api.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.watchlog.api.domain.WatchLogEntity;
import com.watchlog.api.dto.AdminAnalyticsOverviewDto;
import com.watchlog.api.dto.AdminDailyAnalyticsDto;
import com.watchlog.api.dto.AdminDimensionSummaryDto;
import com.watchlog.api.dto.AdminEventBreakdownDto;
import com.watchlog.api.dto.AdminEventRowDto;
import com.watchlog.api.dto.AdminPlatformSummaryDto;
import com.watchlog.api.dto.AdminWeeklyRetroDto;
import com.watchlog.api.dto.PersonalAnalyticsReportDto;
import com.watchlog.api.dto.TrackAnalyticsEventRequest;
import com.watchlog.api.dto.TrackAnalyticsEventResponse;
import com.watchlog.api.repo.UserRepository;
import com.watchlog.api.repo.WatchLogRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class AnalyticsService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String EXCLUDED_ADMIN_ID = "2777a431-5ccb-4761-9c8a-2b17a34ff566";

    private final JdbcTemplate jdbcTemplate;
    private final WatchLogRepository watchLogRepository;
    private final UserRepository userRepository;
    private final String adminAnalyticsToken;

    public AnalyticsService(
            JdbcTemplate jdbcTemplate,
            WatchLogRepository watchLogRepository,
            UserRepository userRepository,
            @Value("${admin.analytics.token:}") String adminAnalyticsToken
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.watchLogRepository = watchLogRepository;
        this.userRepository = userRepository;
        this.adminAnalyticsToken = adminAnalyticsToken;
    }

    @Transactional
    public TrackAnalyticsEventResponse trackEvent(TrackAnalyticsEventRequest req, UUID userId, UUID clientId) {
        UUID eventId = req.eventId() == null ? UUID.randomUUID() : req.eventId();
        OffsetDateTime occurredAt = req.occurredAt() == null ? OffsetDateTime.now() : req.occurredAt();
        UUID safeUserId = resolveKnownUserId(userId);
        String sessionId = (req.sessionId() == null || req.sessionId().isBlank())
                ? "anon-" + eventId
                : req.sessionId().trim();
        String clientVersion = (req.clientVersion() == null || req.clientVersion().isBlank())
                ? null
                : req.clientVersion().trim();

        String propertiesJson;
        try {
            propertiesJson = OBJECT_MAPPER.writeValueAsString(req.properties() == null ? Map.of() : req.properties());
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Invalid properties payload");
        }

        int inserted = jdbcTemplate.update("""
                insert into analytics_events (
                    event_id, user_id, client_id, session_id, event_name, platform, client_version, properties, occurred_at, created_at
                ) values (?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), ?, now())
                on conflict (event_id) do nothing
                """,
                eventId,
                safeUserId,
                clientId,
                sessionId,
                req.eventName(),
                req.platform(),
                clientVersion,
                propertiesJson,
                occurredAt
        );

        return new TrackAnalyticsEventResponse(eventId, inserted > 0, occurredAt);
    }

    @Transactional(readOnly = true)
    public PersonalAnalyticsReportDto personalReport(UUID userId) {
        if (userId == null) {
            throw new IllegalArgumentException("X-User-Id header is required");
        }

        List<WatchLogEntity> logs = watchLogRepository.findByUserId(userId).stream()
                .filter(l -> l.getDeletedAt() == null)
                .toList();
        if (logs.isEmpty()) {
            return new PersonalAnalyticsReportDto(0, 0, 0, 0, 0, "-", "-", "-", 0, 0, null);
        }

        ZoneId kst = ZoneId.of("Asia/Seoul");
        OffsetDateTime now = OffsetDateTime.now(kst);
        int thisMonthLogs = 0;
        int doneCount = 0;
        int ratingCount = 0;
        int noteCount = 0;
        OffsetDateTime lastLoggedAt = logs.getFirst().getWatchedAt();
        Map<String, Integer> typeCounts = new HashMap<>();
        Map<String, Integer> placeCounts = new HashMap<>();
        Map<String, Integer> occasionCounts = new HashMap<>();
        Set<LocalDate> activeDays = new HashSet<>();

        for (WatchLogEntity log : logs) {
            OffsetDateTime watchedAt = log.getWatchedAt();
            if (watchedAt.atZoneSameInstant(kst).getYear() == now.getYear() && 
                watchedAt.atZoneSameInstant(kst).getMonthValue() == now.getMonthValue()) {
                thisMonthLogs += 1;
            }
            if (log.getStatus() != null && "DONE".equals(log.getStatus().name())) {
                doneCount += 1;
            }
            if (log.getRating() != null) {
                ratingCount += 1;
            }
            if (log.getNote() != null && !log.getNote().trim().isEmpty()) {
                noteCount += 1;
            }
            if (lastLoggedAt == null || watchedAt.isAfter(lastLoggedAt)) {
                lastLoggedAt = watchedAt;
            }
            if (log.getTitle() != null && log.getTitle().getType() != null) {
                typeCounts.merge(log.getTitle().getType().name(), 1, Integer::sum);
            }
            if (log.getPlace() != null) {
                placeCounts.merge(log.getPlace().name(), 1, Integer::sum);
            }
            if (log.getOccasion() != null) {
                occasionCounts.merge(log.getOccasion().name(), 1, Integer::sum);
            }
            activeDays.add(watchedAt.atZoneSameInstant(kst).toLocalDate());
        }

        Streak streak = calculateStreak(activeDays, now.toLocalDate());

        return new PersonalAnalyticsReportDto(
                logs.size(),
                thisMonthLogs,
                pct(doneCount, logs.size()),
                pct(ratingCount, logs.size()),
                pct(noteCount, logs.size()),
                topKey(typeCounts),
                topKey(placeCounts),
                topKey(occasionCounts),
                streak.currentDays(),
                streak.longestDays(),
                lastLoggedAt
        );
    }

    @Transactional(readOnly = true)
    public AdminAnalyticsOverviewDto adminOverview(String token, int days) {
        verifyAdminToken(token);

        ZoneId kst = ZoneId.of("Asia/Seoul");
        int safeDays = Math.max(1, Math.min(days, 90));
        OffsetDateTime to = OffsetDateTime.now(kst);
        OffsetDateTime from = to.minusDays(safeDays);

        long events = queryLong("select count(*) from analytics_events where occurred_at >= ? and (user_id is null or user_id::text != ?)", from, EXCLUDED_ADMIN_ID);

        OffsetDateTime startOfTodayKst = LocalDate.now(kst).atStartOfDay(kst).toOffsetDateTime();
        long dau = countDistinctActorsByEventSince("app_open", startOfTodayKst);
        long wau = countDistinctActorsByEventSince("app_open", to.minusDays(7));
        long mau = countDistinctActorsByEventSince("app_open", to.minusDays(30));

        long funnelAppOpenUsers = countDistinctActorsByEventSince("app_open", from);
        long funnelLoginUsers = countDistinctActorsByEventSince("login_success", from);
        long funnelLogCreateUsers = countDistinctActorsByEventSince("log_create", from);
        long retroAppOpenUsers = queryLong("""
                select count(distinct coalesce(client_id::text, user_id::text, session_id))
                from analytics_events
                where event_name = 'app_open'
                  and occurred_at >= ?
                  and coalesce(properties->>'isRetro', 'false') = 'true'
                  and (user_id is null or user_id::text != ?)
                """, from, EXCLUDED_ADMIN_ID);
        long retroToggleUsers = countDistinctActorsByEventSince("retro_mode_toggle", from);

        List<AdminPlatformSummaryDto> platforms = jdbcTemplate.query("""
                select
                    platform,
                    count(*) as events,
                    count(distinct coalesce(client_id::text, user_id::text, session_id)) filter (where event_name = 'app_open') as active_users
                from analytics_events
                where occurred_at >= ?
                  and (user_id is null or user_id::text != ?)
                group by platform
                order by platform asc
                """,
                (rs, rowNum) -> mapPlatformSummary(rs),
                from,
                EXCLUDED_ADMIN_ID
        );
        List<AdminDimensionSummaryDto> deviceTypes = queryAppOpenDimensionSummary("deviceType", from);
        List<AdminDimensionSummaryDto> osFamilies = queryAppOpenDimensionSummary("osFamily", from);
        List<AdminDimensionSummaryDto> browserFamilies = queryAppOpenDimensionSummary("browserFamily", from);
        List<AdminDimensionSummaryDto> installStates = queryAppOpenDimensionSummary("installState", from);

        List<AdminEventBreakdownDto> eventBreakdown = jdbcTemplate.query("""
                select
                    event_name,
                    count(*) as events,
                    count(distinct coalesce(client_id::text, user_id::text, session_id)) as actors
                from analytics_events
                where occurred_at >= ?
                  and (user_id is null or user_id::text != ?)
                group by event_name
                order by events desc, event_name asc
                """,
                (rs, rowNum) -> new AdminEventBreakdownDto(
                        rs.getString("event_name"),
                        rs.getLong("events"),
                        rs.getLong("actors")
                ),
                from,
                EXCLUDED_ADMIN_ID
        );

        List<AdminDailyAnalyticsDto> daily = jdbcTemplate.query("""
                select
                    date_trunc('day', occurred_at at time zone 'Asia/Seoul')::date as day,
                    count(*) as events,
                    count(distinct coalesce(client_id::text, user_id::text, session_id)) filter (where event_name = 'app_open') as app_open_users,
                    count(distinct coalesce(client_id::text, user_id::text, session_id)) filter (where event_name = 'app_open' and coalesce(properties->>'isRetro', 'false') = 'true') as retro_app_open_users,
                    count(distinct coalesce(client_id::text, user_id::text, session_id)) filter (where event_name = 'retro_mode_toggle') as retro_toggle_users,
                    count(distinct coalesce(client_id::text, user_id::text, session_id)) filter (where event_name = 'login_success') as login_users,
                    count(distinct coalesce(client_id::text, user_id::text, session_id)) filter (where event_name = 'log_create') as log_create_users,
                    count(distinct coalesce(client_id::text, user_id::text, session_id)) filter (where event_name = 'share_action') as share_action_users
                from analytics_events
                where occurred_at >= ?
                  and (user_id is null or user_id::text != ?)
                group by 1
                order by 1 desc
                """,
                (rs, rowNum) -> new AdminDailyAnalyticsDto(
                        rs.getObject("day", LocalDate.class),
                        rs.getLong("events"),
                        rs.getLong("app_open_users"),
                        rs.getLong("retro_app_open_users"),
                        rs.getLong("retro_toggle_users"),
                        rs.getLong("login_users"),
                        rs.getLong("log_create_users"),
                        rs.getLong("share_action_users")
                ),
                from,
                EXCLUDED_ADMIN_ID
        );

        List<AdminWeeklyRetroDto> weeklyRetro = jdbcTemplate.query("""
                select
                    date_trunc('week', occurred_at at time zone 'Asia/Seoul')::date as week_start,
                    count(distinct coalesce(client_id::text, user_id::text, session_id)) filter (where event_name = 'app_open') as app_open_users,
                    count(distinct coalesce(client_id::text, user_id::text, session_id)) filter (where event_name = 'app_open' and coalesce(properties->>'isRetro', 'false') = 'true') as retro_app_open_users,
                    count(distinct coalesce(client_id::text, user_id::text, session_id)) filter (where event_name = 'retro_mode_toggle') as retro_toggle_users,
                    count(distinct coalesce(client_id::text, user_id::text, session_id)) filter (where event_name = 'retro_mode_toggle' and coalesce(properties->>'enabled', 'false') = 'true') as retro_toggle_on_users
                from analytics_events
                where occurred_at >= ?
                  and (user_id is null or user_id::text != ?)
                group by 1
                order by 1 desc
                """,
                (rs, rowNum) -> new AdminWeeklyRetroDto(
                        rs.getObject("week_start", LocalDate.class),
                        rs.getLong("app_open_users"),
                        rs.getLong("retro_app_open_users"),
                        rs.getLong("retro_toggle_users"),
                        rs.getLong("retro_toggle_on_users")
                ),
                from,
                EXCLUDED_ADMIN_ID
        );

        return new AdminAnalyticsOverviewDto(
                safeDays,
                from,
                to,
                events,
                dau,
                wau,
                mau,
                funnelAppOpenUsers,
                funnelLoginUsers,
                funnelLogCreateUsers,
                retroAppOpenUsers,
                retroToggleUsers,
                platforms,
                deviceTypes,
                osFamilies,
                browserFamilies,
                installStates,
                eventBreakdown,
                daily,
                weeklyRetro
        );
    }

    @Transactional(readOnly = true)
    public List<AdminEventRowDto> adminRecentEvents(
            String token,
            int days,
            int limit,
            String eventName,
            String platform
    ) {
        verifyAdminToken(token);

        int safeDays = Math.max(1, Math.min(days, 90));
        int safeLimit = Math.max(1, Math.min(limit, 500));
        OffsetDateTime from = OffsetDateTime.now().minusDays(safeDays);
        String normalizedEventName = eventName == null || eventName.isBlank() ? null : eventName.trim();
        String normalizedPlatform = platform == null || platform.isBlank() ? null : platform.trim();

        return jdbcTemplate.query("""
                select
                    event_id,
                    user_id,
                    session_id,
                    event_name,
                    platform,
                    client_version,
                    properties::text as properties,
                    occurred_at,
                    created_at
                from analytics_events
                where occurred_at >= ?
                  and (cast(? as text) is null or event_name = cast(? as text))
                  and (cast(? as text) is null or platform = cast(? as text))
                  and (user_id is null or user_id::text != ?)
                order by occurred_at desc
                limit ?
                """,
                (rs, rowNum) -> new AdminEventRowDto(
                        rs.getObject("event_id", UUID.class),
                        rs.getObject("user_id", UUID.class),
                        rs.getString("session_id"),
                        rs.getString("event_name"),
                        rs.getString("platform"),
                        rs.getString("client_version"),
                        rs.getString("properties"),
                        rs.getObject("occurred_at", OffsetDateTime.class),
                        rs.getObject("created_at", OffsetDateTime.class)
                ),
                from,
                normalizedEventName,
                normalizedEventName,
                normalizedPlatform,
                normalizedPlatform,
                EXCLUDED_ADMIN_ID,
                safeLimit
        );
    }

    private long countDistinctActorsByEventSince(String eventName, OffsetDateTime since) {
        return queryLong("""
                select count(distinct coalesce(client_id::text, user_id::text, session_id))
                from analytics_events
                where event_name = ? and occurred_at >= ?
                  and (user_id is null or user_id::text != ?)
                """, eventName, since, EXCLUDED_ADMIN_ID);
    }

    private long queryLong(String sql, Object... args) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
        return value == null ? 0L : value;
    }

    private List<AdminDimensionSummaryDto> queryAppOpenDimensionSummary(String propertyKey, OffsetDateTime from) {
        return jdbcTemplate.query("""
                select
                    coalesce(nullif(properties->>?, ''), 'unknown') as dim_key,
                    count(*) as events,
                    count(distinct coalesce(client_id::text, user_id::text, session_id)) as active_users
                from analytics_events
                where event_name = 'app_open'
                  and occurred_at >= ?
                  and (user_id is null or user_id::text != ?)
                group by 1
                order by events desc, dim_key asc
                """,
                (rs, rowNum) -> new AdminDimensionSummaryDto(
                        rs.getString("dim_key"),
                        rs.getLong("events"),
                        rs.getLong("active_users")
                ),
                propertyKey,
                from,
                EXCLUDED_ADMIN_ID
        );
    }

    private void verifyAdminToken(String token) {
        if (adminAnalyticsToken == null || adminAnalyticsToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin analytics token is not configured");
        }
        if (!adminAnalyticsToken.equals(token)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
    }

    private UUID resolveKnownUserId(UUID userId) {
        if (userId == null) return null;
        return userRepository.existsById(userId) ? userId : null;
    }

    private AdminPlatformSummaryDto mapPlatformSummary(ResultSet rs) throws SQLException {
        return new AdminPlatformSummaryDto(
                rs.getString("platform"),
                rs.getLong("events"),
                rs.getLong("active_users")
        );
    }

    private double pct(int numerator, int denominator) {
        if (denominator == 0) return 0;
        return Math.round((numerator * 1000.0) / denominator) / 10.0;
    }

    private String topKey(Map<String, Integer> counts) {
        return counts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("-");
    }

    private Streak calculateStreak(Set<LocalDate> activeDays, LocalDate today) {
        if (activeDays.isEmpty()) {
            return new Streak(0, 0);
        }

        List<LocalDate> sorted = activeDays.stream().sorted().toList();
        int longest = 1;
        int run = 1;
        for (int i = 1; i < sorted.size(); i += 1) {
            if (sorted.get(i - 1).plusDays(1).equals(sorted.get(i))) {
                run += 1;
                longest = Math.max(longest, run);
            } else {
                run = 1;
            }
        }

        int current = 0;
        LocalDate anchor = activeDays.contains(today) ? today : (activeDays.contains(today.minusDays(1)) ? today.minusDays(1) : null);
        if (anchor != null) {
            LocalDate cursor = anchor;
            while (activeDays.contains(cursor)) {
                current += 1;
                cursor = cursor.minusDays(1);
            }
        }

        return new Streak(current, longest);
    }

    private record Streak(int currentDays, int longestDays) {}
}
