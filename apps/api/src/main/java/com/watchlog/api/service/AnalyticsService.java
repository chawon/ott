package com.watchlog.api.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.watchlog.api.domain.WatchLogEntity;
import com.watchlog.api.dto.AdminActivitySummaryDto;
import com.watchlog.api.dto.AdminAcquisitionAnalyticsDto;
import com.watchlog.api.dto.AdminAcquisitionDailyDto;
import com.watchlog.api.dto.AdminAcquisitionDimensionDto;
import com.watchlog.api.dto.AdminAcquisitionSummaryDto;
import com.watchlog.api.dto.AdminAnalyticsOverviewDto;
import com.watchlog.api.dto.AdminDailyAnalyticsDto;
import com.watchlog.api.dto.AdminDimensionSummaryDto;
import com.watchlog.api.dto.AdminEventBreakdownDto;
import com.watchlog.api.dto.AdminEventRowDto;
import com.watchlog.api.dto.AdminPlatformSummaryDto;
import com.watchlog.api.dto.AdminMigrationStatusDto;
import com.watchlog.api.dto.PersonalAnalyticsReportDto;
import com.watchlog.api.dto.SeasonalRecapDto;
import com.watchlog.api.dto.SeasonalRecapPosterDto;
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

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.DayOfWeek;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Service
public class AnalyticsService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String EXCLUDED_ADMIN_ID = "2777a431-5ccb-4761-9c8a-2b17a34ff566";

    private final JdbcTemplate jdbcTemplate;
    private final AnalyticsMetricsQuery analyticsMetricsQuery;
    private final AcquisitionAnalyticsQuery acquisitionAnalyticsQuery;
    private final WatchLogRepository watchLogRepository;
    private final UserRepository userRepository;
    private final String adminAnalyticsToken;

    public AnalyticsService(
            JdbcTemplate jdbcTemplate,
            AnalyticsMetricsQuery analyticsMetricsQuery,
            AcquisitionAnalyticsQuery acquisitionAnalyticsQuery,
            WatchLogRepository watchLogRepository,
            UserRepository userRepository,
            @Value("${admin.analytics.token:}") String adminAnalyticsToken
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.analyticsMetricsQuery = analyticsMetricsQuery;
        this.acquisitionAnalyticsQuery = acquisitionAnalyticsQuery;
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
            return new PersonalAnalyticsReportDto(0, 0, 0, 0, 0, "-", "-", "-", 0, 0, null, 0, "-", 0, 0, null, null, null, null, null);
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
        Map<String, Integer> monthlyGenreCounts = new HashMap<>();
        Set<LocalDate> activeDays = new HashSet<>();
        LocalDate today = now.toLocalDate();
        LocalDate thisMonday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate previousMonday = thisMonday.minusWeeks(1);
        int previousWeekLogs = 0;
        WatchLogEntity continueSeriesLog = null;

        for (WatchLogEntity log : logs) {
            OffsetDateTime watchedAt = log.getWatchedAt();
            LocalDate watchedDate = watchedAt.atZoneSameInstant(kst).toLocalDate();
            if (watchedAt.atZoneSameInstant(kst).getYear() == now.getYear() && 
                watchedAt.atZoneSameInstant(kst).getMonthValue() == now.getMonthValue()) {
                thisMonthLogs += 1;
                if (log.getTitle() != null && log.getTitle().getGenres() != null) {
                    for (String genre : log.getTitle().getGenres()) {
                        if (genre != null && !genre.isBlank()) {
                            monthlyGenreCounts.merge(genre.trim(), 1, Integer::sum);
                        }
                    }
                }
            }
            if (!watchedDate.isBefore(previousMonday) && watchedDate.isBefore(thisMonday)) {
                previousWeekLogs += 1;
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
            activeDays.add(watchedDate);
            if (isSeriesContinueCandidate(log, watchedDate, today)
                    && (continueSeriesLog == null || watchedAt.isAfter(continueSeriesLog.getWatchedAt()))) {
                continueSeriesLog = log;
            }
        }

        Streak streak = calculateStreak(activeDays, now.toLocalDate());
        LocalDate lastLoggedDate = lastLoggedAt == null ? null : lastLoggedAt.atZoneSameInstant(kst).toLocalDate();
        int daysSinceLastLog = lastLoggedDate == null ? 0 : Math.max(0, (int) ChronoUnit.DAYS.between(lastLoggedDate, today));
        TopCount monthlyTopGenre = topCount(monthlyGenreCounts);

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
                lastLoggedAt,
                previousWeekLogs,
                monthlyTopGenre.label(),
                monthlyTopGenre.count(),
                daysSinceLastLog,
                continueSeriesLog == null ? null : continueSeriesLog.getTitle().getId(),
                continueSeriesLog == null ? null : continueSeriesLog.getTitle().getName(),
                continueSeriesLog == null ? null : continueSeriesLog.getSeasonNumber(),
                continueSeriesLog == null ? null : continueSeriesLog.getEpisodeNumber(),
                buildSeasonalRecap(logs, kst)
        );
    }

    private SeasonalRecapDto buildSeasonalRecap(List<WatchLogEntity> logs, ZoneId zone) {
        LocalDate start = LocalDate.of(2026, 1, 1);
        LocalDate endExclusive = LocalDate.of(2026, 7, 1);
        Map<String, Integer> typeCounts = new HashMap<>();
        Map<String, Integer> placeCounts = new HashMap<>();
        Map<String, Integer> occasionCounts = new HashMap<>();
        Map<UUID, PosterAccumulator> posterCounts = new HashMap<>();
        int total = 0;
        int doneCount = 0;
        int noteCount = 0;

        for (WatchLogEntity log : logs) {
            OffsetDateTime watchedAt = log.getWatchedAt();
            if (watchedAt == null) continue;
            LocalDate watchedDate = watchedAt.atZoneSameInstant(zone).toLocalDate();
            if (watchedDate.isBefore(start) || !watchedDate.isBefore(endExclusive)) continue;

            total += 1;
            if (log.getStatus() != null && "DONE".equals(log.getStatus().name())) {
                doneCount += 1;
            }
            if (log.getNote() != null && !log.getNote().trim().isEmpty()) {
                noteCount += 1;
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

            if (log.getTitle() == null) continue;
            UUID titleId = log.getTitle().getId();
            String preferredPoster = firstNonBlank(log.getSeasonPosterUrl(), log.getTitle().getPosterUrl());
            PosterAccumulator accumulator = posterCounts.computeIfAbsent(
                    titleId,
                    ignored -> new PosterAccumulator(
                            titleId,
                            log.getTitle().getName(),
                            log.getTitle().getType() == null ? "-" : log.getTitle().getType().name()
                    )
            );
            accumulator.count += 1;
            if (accumulator.posterUrl == null && preferredPoster != null) {
                accumulator.posterUrl = preferredPoster;
            }
            if (log.getRating() != null) {
                accumulator.addRating(log.getRating().doubleValue());
            }
            if (accumulator.lastLoggedAt == null || watchedAt.isAfter(accumulator.lastLoggedAt)) {
                accumulator.lastLoggedAt = watchedAt;
            }
        }

        if (total == 0) return null;

        List<SeasonalRecapPosterDto> posters = posterCounts.values().stream()
                .sorted(this::compareSeasonalPoster)
                .limit(6)
                .map(item -> new SeasonalRecapPosterDto(
                        item.titleId,
                        item.title,
                        item.titleType,
                        item.posterUrl,
                        item.count,
                        item.lastLoggedAt
                ))
                .toList();

        return new SeasonalRecapDto(
                "2026-H1",
                start.toString(),
                endExclusive.minusDays(1).toString(),
                total,
                topKey(typeCounts),
                topKey(placeCounts),
                topKey(occasionCounts),
                pct(doneCount, total),
                pct(noteCount, total),
                posters
        );
    }

    private int compareSeasonalPoster(PosterAccumulator a, PosterAccumulator b) {
        int posterCompare = Boolean.compare(b.posterUrl != null, a.posterUrl != null);
        if (posterCompare != 0) return posterCompare;
        int ratingPresenceCompare = Boolean.compare(b.bestRating != null, a.bestRating != null);
        if (ratingPresenceCompare != 0) return ratingPresenceCompare;
        if (a.bestRating != null && b.bestRating != null) {
            int ratingCompare = Double.compare(b.bestRating, a.bestRating);
            if (ratingCompare != 0) return ratingCompare;
            int ratedCountCompare = Integer.compare(b.ratedCount, a.ratedCount);
            if (ratedCountCompare != 0) return ratedCountCompare;
        }
        int countCompare = Integer.compare(b.count, a.count);
        if (countCompare != 0) return countCompare;
        if (a.lastLoggedAt == null && b.lastLoggedAt == null) return 0;
        if (a.lastLoggedAt == null) return 1;
        if (b.lastLoggedAt == null) return -1;
        return b.lastLoggedAt.compareTo(a.lastLoggedAt);
    }

    private String firstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) return primary;
        if (fallback != null && !fallback.isBlank()) return fallback;
        return null;
    }

    private static class PosterAccumulator {
        private final UUID titleId;
        private final String title;
        private final String titleType;
        private String posterUrl;
        private int count;
        private OffsetDateTime lastLoggedAt;
        private Double bestRating;
        private int ratedCount;

        private PosterAccumulator(UUID titleId, String title, String titleType) {
            this.titleId = titleId;
            this.title = title;
            this.titleType = titleType;
        }

        private void addRating(double rating) {
            ratedCount += 1;
            if (bestRating == null || rating > bestRating) {
                bestRating = rating;
            }
        }
    }

    private boolean isSeriesContinueCandidate(WatchLogEntity log, LocalDate watchedDate, LocalDate today) {
        if (log.getTitle() == null || log.getTitle().getType() == null || !"series".equals(log.getTitle().getType().name())) {
            return false;
        }
        if (!"IN_PROGRESS".equals(log.getStatus().name()) && log.getSeasonNumber() == null && log.getEpisodeNumber() == null) {
            return false;
        }
        return !watchedDate.isBefore(today.minusDays(14)) && !watchedDate.isAfter(today.minusDays(2));
    }

    @Transactional(readOnly = true)
    public AdminAnalyticsOverviewDto adminOverview(String token, int days) {
        verifyAdminToken(token);

        AnalyticsMetricsQuery.CalendarWindows windows = analyticsMetricsQuery.calendarWindows(
                days,
                OffsetDateTime.now(ZoneId.of("Asia/Seoul"))
        );
        OffsetDateTime from = windows.periodFrom();
        OffsetDateTime to = windows.to();

        AnalyticsMetricsQuery.PeriodSummary period = analyticsMetricsQuery.summarize(from, to);
        AnalyticsMetricsQuery.PeriodSummary today = analyticsMetricsQuery.summarize(windows.todayFrom(), to);
        AnalyticsMetricsQuery.PeriodSummary last7Days = analyticsMetricsQuery.summarize(windows.last7DaysFrom(), to);
        AnalyticsMetricsQuery.PeriodSummary last30Days = analyticsMetricsQuery.summarize(windows.last30DaysFrom(), to);

        List<AdminPlatformSummaryDto> platforms = analyticsMetricsQuery.summarizePlatforms(from, to).stream()
                .map(summary -> new AdminPlatformSummaryDto(
                        summary.platform(),
                        summary.events(),
                        summary.activeUsers(),
                        summary.rawAppOpenEvents(),
                        summary.appOpenSessions(),
                        summary.activeClients(),
                        summary.qualifiedActors()
                ))
                .toList();
        List<AdminDimensionSummaryDto> deviceTypes = mapDimensionSummaries(
                analyticsMetricsQuery.summarizeAppOpenDimension("deviceType", from, to)
        );
        List<AdminDimensionSummaryDto> osFamilies = mapDimensionSummaries(
                analyticsMetricsQuery.summarizeAppOpenDimension("osFamily", from, to)
        );
        List<AdminDimensionSummaryDto> browserFamilies = mapDimensionSummaries(
                analyticsMetricsQuery.summarizeAppOpenDimension("browserFamily", from, to)
        );
        List<AdminDimensionSummaryDto> installStates = mapDimensionSummaries(
                analyticsMetricsQuery.summarizeAppOpenDimension("installState", from, to)
        );
        List<AdminDimensionSummaryDto> domains = mapDimensionSummaries(
                analyticsMetricsQuery.summarizeAppOpenDimension("hostname", from, to)
        );
        List<AdminDimensionSummaryDto> iosAppVersions = mapDimensionSummaries(
                analyticsMetricsQuery.summarizePlatformAppOpenDimension("ios_native", "appVersion", from, to)
        );
        List<AdminDimensionSummaryDto> iosBuildNumbers = mapDimensionSummaries(
                analyticsMetricsQuery.summarizePlatformAppOpenDimension("ios_native", "buildNumber", from, to)
        );
        List<AdminDimensionSummaryDto> androidAppVersions = mapDimensionSummaries(
                analyticsMetricsQuery.summarizeAndroidAppOpenDimension("androidAppVersion", from, to)
        );
        List<AdminDimensionSummaryDto> androidAppVersionCodes = mapDimensionSummaries(
                analyticsMetricsQuery.summarizeAndroidAppOpenDimension("androidAppVersionCode", from, to)
        );
        List<AdminDimensionSummaryDto> androidTwaSignals = mapDimensionSummaries(
                analyticsMetricsQuery.summarizeAndroidAppOpenDimension("androidTwaSignal", from, to)
        );

        List<AdminEventBreakdownDto> eventBreakdown = analyticsMetricsQuery.summarizeEventBreakdown(from, to).stream()
                .map(summary -> new AdminEventBreakdownDto(
                        summary.eventName(),
                        summary.events(),
                        summary.actors()
                ))
                .toList();
        List<AdminDailyAnalyticsDto> daily = analyticsMetricsQuery.summarizeDaily(from, to).stream()
                .map(summary -> new AdminDailyAnalyticsDto(
                        summary.day(),
                        summary.events(),
                        summary.appOpenActors(),
                        summary.reach().titleSearchActors(),
                        summary.reach().titleSelectActors(),
                        summary.reach().loginActors(),
                        summary.reach().firstLogCreateActors(),
                        summary.reach().logCreateActors(),
                        summary.activity(),
                        summary.reach()
                ))
                .toList();

        AdminActivitySummaryDto activity = new AdminActivitySummaryDto(
                period.activity(),
                today.activity(),
                last7Days.activity(),
                last30Days.activity()
        );

        return new AdminAnalyticsOverviewDto(
                windows.days(),
                from,
                to,
                period.events(),
                today.appOpenActors(),
                last7Days.appOpenActors(),
                last30Days.appOpenActors(),
                period.appOpenActors(),
                period.reach().titleSearchActors(),
                period.reach().titleSelectActors(),
                period.reach().loginActors(),
                period.reach().firstLogCreateActors(),
                period.reach().logCreateActors(),
                platforms,
                deviceTypes,
                osFamilies,
                browserFamilies,
                installStates,
                domains,
                iosAppVersions,
                iosBuildNumbers,
                androidAppVersions,
                androidAppVersionCodes,
                androidTwaSignals,
                eventBreakdown,
                daily,
                activity,
                period.reach()
        );
    }

    @Transactional(readOnly = true)
    public AdminAcquisitionAnalyticsDto adminAcquisition(String token, int days) {
        verifyAdminToken(token);
        if (!Set.of(7, 30, 90, 180).contains(days)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "days must be one of 7, 30, 90, or 180"
            );
        }

        AnalyticsMetricsQuery.CalendarWindows windows = analyticsMetricsQuery.acquisitionCalendarWindows(
                days,
                OffsetDateTime.now(ZoneId.of("Asia/Seoul"))
        );
        AcquisitionAnalyticsQuery.Result result = acquisitionAnalyticsQuery.summarize(
                windows.periodFrom(),
                windows.to()
        );

        return new AdminAcquisitionAnalyticsDto(
                windows.days(),
                windows.periodFrom(),
                windows.to(),
                mapAcquisitionSummary(result.summary()),
                mapAcquisitionDimensions(result.byChannel()),
                mapAcquisitionDimensions(result.bySource()),
                mapAcquisitionDimensions(result.byLandingPath()),
                mapAcquisitionDimensions(result.byLocale()),
                mapAcquisitionDimensions(result.byCampaign()),
                result.daily().stream()
                        .map(row -> new AdminAcquisitionDailyDto(
                                row.day(),
                                row.metrics().sessions(),
                                row.metrics().engagedSessions(),
                                row.metrics().firstLogSessions(),
                                row.metrics().logCreateSessions()
                        ))
                        .toList(),
                result.orphanConversionSessions()
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
        AnalyticsMetricsQuery.CalendarWindows windows = analyticsMetricsQuery.calendarWindows(
                safeDays,
                OffsetDateTime.now(ZoneId.of("Asia/Seoul"))
        );
        OffsetDateTime from = windows.periodFrom();
        OffsetDateTime to = windows.to();
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
                  and occurred_at < ?
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
                to,
                normalizedEventName,
                normalizedEventName,
                normalizedPlatform,
                normalizedPlatform,
                EXCLUDED_ADMIN_ID,
                safeLimit
        );
    }

    private long queryLong(String sql, Object... args) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
        return value == null ? 0L : value;
    }

    private List<AdminDimensionSummaryDto> mapDimensionSummaries(
            List<AnalyticsMetricsQuery.DimensionSummary> summaries
    ) {
        return summaries.stream()
                .map(summary -> new AdminDimensionSummaryDto(
                        summary.key(),
                        summary.events(),
                        summary.activeUsers(),
                        summary.appOpenSessions(),
                        summary.activeClients()
                ))
                .toList();
    }

    private AdminAcquisitionSummaryDto mapAcquisitionSummary(AcquisitionAnalyticsQuery.Metrics metrics) {
        return new AdminAcquisitionSummaryDto(
                metrics.sessions(),
                metrics.engagedSessions(),
                metrics.firstLogSessions(),
                metrics.logCreateSessions()
        );
    }

    private List<AdminAcquisitionDimensionDto> mapAcquisitionDimensions(
            List<AcquisitionAnalyticsQuery.DimensionMetrics> dimensions
    ) {
        return dimensions.stream()
                .map(row -> new AdminAcquisitionDimensionDto(
                        row.key(),
                        row.metrics().sessions(),
                        row.metrics().engagedSessions(),
                        row.metrics().firstLogSessions(),
                        row.metrics().logCreateSessions()
                ))
                .toList();
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

    private TopCount topCount(Map<String, Integer> counts) {
        return counts.entrySet().stream()
                .filter(entry -> entry.getValue() > 0)
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed()
                        .thenComparing(Map.Entry.comparingByKey()))
                .map(entry -> new TopCount(entry.getKey(), entry.getValue()))
                .findFirst()
                .orElse(new TopCount("-", 0));
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

    private record TopCount(String label, int count) {}

    private record Streak(int currentDays, int longestDays) {}
    public AdminMigrationStatusDto adminMigrationStatus(String token) {
        verifyAdminToken(token);

        long totalActiveUsers = queryLong("""
                select count(*) from (
                    select user_id from watch_logs
                    where user_id is not null
                    group by user_id having count(*) >= 2
                ) t
                """);

        long migratedUsers = queryLong("""
                select count(distinct user_id) from analytics_events
                where event_name = 'migration_complete'
                  and user_id is not null
                """);

        long notMigratedUsers = Math.max(0, totalActiveUsers - migratedUsers);
        double migrationRate = totalActiveUsers == 0 ? 0.0
                : Math.round(migratedUsers * 1000.0 / totalActiveUsers) / 10.0;

        List<AdminMigrationStatusDto.DailyCount> recentMigrations = jdbcTemplate.query("""
                select date(occurred_at) as day, count(*) as cnt
                from analytics_events
                where event_name = 'migration_complete'
                group by date(occurred_at)
                order by day desc
                limit 14
                """,
                (rs, i) -> new AdminMigrationStatusDto.DailyCount(
                        rs.getDate("day").toLocalDate(),
                        rs.getLong("cnt")
                ));

        return new AdminMigrationStatusDto(totalActiveUsers, migratedUsers, notMigratedUsers, migrationRate, recentMigrations);
    }

}
