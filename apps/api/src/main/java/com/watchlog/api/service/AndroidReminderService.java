package com.watchlog.api.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.watchlog.api.domain.Status;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.domain.WatchLogEntity;
import com.watchlog.api.dto.AndroidNotificationDeviceBindRequest;
import com.watchlog.api.dto.AndroidNotificationDeviceBindResponse;
import com.watchlog.api.dto.AndroidNotificationPreferenceRequest;
import com.watchlog.api.dto.AndroidReminderCandidateDto;
import com.watchlog.api.dto.AndroidReminderNextRequest;
import com.watchlog.api.dto.AndroidReminderNextResponse;
import com.watchlog.api.repo.WatchLogRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class AndroidReminderService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Asia/Seoul");
    private static final int MIN_TOKEN_LENGTH = 32;
    private static final int MAX_TOKEN_LENGTH = 512;

    private final JdbcTemplate jdbcTemplate;
    private final WatchLogRepository watchLogRepository;

    public AndroidReminderService(JdbcTemplate jdbcTemplate, WatchLogRepository watchLogRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.watchLogRepository = watchLogRepository;
    }

    @Transactional
    public AndroidNotificationDeviceBindResponse bindDevice(
            UUID userId,
            UUID deviceId,
            AndroidNotificationDeviceBindRequest request
    ) {
        String tokenHash = tokenHash(request == null ? null : request.installToken());
        boolean notificationPermission = Boolean.TRUE.equals(request.notificationPermissionGranted());
        Boolean requestedEnabled = request.revisitRemindersEnabled();
        boolean insertEnabled = requestedEnabled == null || requestedEnabled;
        UUID androidDeviceId = UUID.randomUUID();

        jdbcTemplate.update("""
                insert into android_notification_devices (
                    id, user_id, device_id, install_token_hash, version_name, version_code,
                    notification_permission_granted, revisit_reminders_enabled,
                    created_at, updated_at, last_bound_at, revoked_at
                ) values (?, ?, ?, ?, ?, ?, ?, ?, now(), now(), now(), null)
                on conflict (install_token_hash) do update set
                    user_id = excluded.user_id,
                    device_id = excluded.device_id,
                    version_name = excluded.version_name,
                    version_code = excluded.version_code,
                    notification_permission_granted = excluded.notification_permission_granted,
                    revisit_reminders_enabled = case
                        when cast(? as boolean) is null
                        then android_notification_devices.revisit_reminders_enabled
                        else excluded.revisit_reminders_enabled
                    end,
                    updated_at = now(),
                    last_bound_at = now(),
                    revoked_at = null
                """,
                androidDeviceId,
                userId,
                deviceId,
                tokenHash,
                cleanVersionName(request.versionName()),
                request.versionCode(),
                notificationPermission,
                insertEnabled,
                requestedEnabled
        );

        DeviceRow row = requireDevice(tokenHash);
        return new AndroidNotificationDeviceBindResponse(true, row.revisitRemindersEnabled());
    }

    @Transactional
    public void updatePreferences(AndroidNotificationPreferenceRequest request) {
        String tokenHash = tokenHash(request == null ? null : request.installToken());
        jdbcTemplate.update("""
                update android_notification_devices
                set
                    notification_permission_granted = coalesce(cast(? as boolean), notification_permission_granted),
                    revisit_reminders_enabled = coalesce(cast(? as boolean), revisit_reminders_enabled),
                    version_name = coalesce(cast(? as varchar), version_name),
                    version_code = coalesce(cast(? as integer), version_code),
                    updated_at = now()
                where install_token_hash = ?
                  and revoked_at is null
                """,
                request.notificationPermissionGranted(),
                request.revisitRemindersEnabled(),
                cleanVersionName(request.versionName()),
                request.versionCode(),
                tokenHash
        );
    }

    @Transactional
    public AndroidReminderNextResponse nextReminder(AndroidReminderNextRequest request) {
        String tokenHash = tokenHash(request == null ? null : request.installToken());
        updateDevicePollContext(tokenHash, request);
        DeviceRow device = findDevice(tokenHash).orElse(null);
        if (device == null || !device.revisitRemindersEnabled() || !device.notificationPermissionGranted()) {
            return new AndroidReminderNextResponse(null);
        }

        ZoneId zone = safeZone(request.timeZone());
        OffsetDateTime now = OffsetDateTime.now(zone);
        if (hasDeliveryToday(device.userId(), now, zone)) {
            return new AndroidReminderNextResponse(null);
        }

        List<WatchLogEntity> logs = watchLogRepository.findByUserId(device.userId()).stream()
                .filter(log -> log.getDeletedAt() == null)
                .toList();
        List<Candidate> candidates = buildCandidates(logs, now, zone, isEnglish(request.locale()));
        for (Candidate candidate : candidates) {
            Optional<AndroidReminderCandidateDto> inserted = insertDelivery(device, candidate);
            if (inserted.isPresent()) {
                return new AndroidReminderNextResponse(inserted.get());
            }
        }
        return new AndroidReminderNextResponse(null);
    }

    @Transactional
    public void markDelivered(UUID deliveryId, String installToken) {
        String tokenHash = tokenHash(installToken);
        jdbcTemplate.update("""
                update android_notification_deliveries
                set delivered_at = coalesce(delivered_at, now())
                where id = ?
                  and android_device_id = (
                    select id from android_notification_devices
                    where install_token_hash = ?
                      and revoked_at is null
                  )
                """,
                deliveryId,
                tokenHash
        );
    }

    @Transactional
    public void markOpened(UUID deliveryId, String installToken) {
        String tokenHash = tokenHash(installToken);
        jdbcTemplate.update("""
                update android_notification_deliveries
                set
                    delivered_at = coalesce(delivered_at, now()),
                    opened_at = coalesce(opened_at, now())
                where id = ?
                  and android_device_id = (
                    select id from android_notification_devices
                    where install_token_hash = ?
                      and revoked_at is null
                  )
                """,
                deliveryId,
                tokenHash
        );
    }

    @Transactional
    public void revokeByDevice(UUID userId, UUID deviceId) {
        if (userId == null || deviceId == null) return;
        jdbcTemplate.update("""
                update android_notification_devices
                set revoked_at = coalesce(revoked_at, now()), updated_at = now()
                where user_id = ?
                  and device_id = ?
                  and revoked_at is null
                """,
                userId,
                deviceId
        );
    }

    @Transactional
    public void revokeByUser(UUID userId) {
        if (userId == null) return;
        jdbcTemplate.update("""
                update android_notification_devices
                set revoked_at = coalesce(revoked_at, now()), updated_at = now()
                where user_id = ?
                  and revoked_at is null
                """,
                userId
        );
    }

    private void updateDevicePollContext(String tokenHash, AndroidReminderNextRequest request) {
        jdbcTemplate.update("""
                update android_notification_devices
                set
                    notification_permission_granted = coalesce(cast(? as boolean), notification_permission_granted),
                    version_name = coalesce(cast(? as varchar), version_name),
                    version_code = coalesce(cast(? as integer), version_code),
                    last_polled_at = now(),
                    updated_at = now()
                where install_token_hash = ?
                  and revoked_at is null
                """,
                request.notificationPermissionGranted(),
                cleanVersionName(request.versionName()),
                request.versionCode(),
                tokenHash
        );
    }

    private List<Candidate> buildCandidates(
            List<WatchLogEntity> logs,
            OffsetDateTime now,
            ZoneId zone,
            boolean english
    ) {
        List<Candidate> candidates = new ArrayList<>();
        monthlyGenreCandidate(logs, now, zone, english).ifPresent(candidates::add);
        weeklyRecapCandidate(logs, now, zone, english).ifPresent(candidates::add);
        sevenDayGapCandidate(logs, now, zone, english).ifPresent(candidates::add);
        seriesContinueCandidate(logs, now, zone, english).ifPresent(candidates::add);
        return candidates;
    }

    private Optional<Candidate> monthlyGenreCandidate(
            List<WatchLogEntity> logs,
            OffsetDateTime now,
            ZoneId zone,
            boolean english
    ) {
        LocalDate today = now.atZoneSameInstant(zone).toLocalDate();
        if (today.getDayOfMonth() != 1) return Optional.empty();

        YearMonth previousMonth = YearMonth.from(today).minusMonths(1);
        LocalDate from = previousMonth.atDay(1);
        LocalDate to = previousMonth.plusMonths(1).atDay(1);
        Map<String, Integer> genreCounts = new LinkedHashMap<>();

        for (WatchLogEntity log : logs) {
            LocalDate watched = localDate(log, zone);
            if (watched.isBefore(from) || !watched.isBefore(to)) continue;
            if (log.getTitle() == null || log.getTitle().getGenres() == null) continue;
            for (String genre : log.getTitle().getGenres()) {
                String normalized = cleanText(genre, 64);
                if (normalized == null) continue;
                genreCounts.merge(normalized, 1, Integer::sum);
            }
        }

        TopCount topGenre = topCount(genreCounts).orElse(null);
        if (topGenre == null || topGenre.count() < 2) return Optional.empty();

        String period = previousMonth.toString();
        String title = english
                ? "Your top genre last month was " + topGenre.label()
                : "지난달엔 " + topGenre.label() + " 기록이 가장 많았어요";
        String body = english
                ? "Open your monthly recap and turn it into a share card."
                : "월간 회고를 열어 묶음 공유카드로 남겨보세요.";
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("period", period);
        metadata.put("genre", topGenre.label());
        metadata.put("count", topGenre.count());
        return Optional.of(new Candidate(
                "MONTHLY_GENRE",
                "monthly_genre:" + period,
                title,
                body,
                "https://ottline.app/me/report?source=android-revisit-reminder&reminder=monthly_genre&period=" + period,
                metadata
        ));
    }

    private Optional<Candidate> weeklyRecapCandidate(
            List<WatchLogEntity> logs,
            OffsetDateTime now,
            ZoneId zone,
            boolean english
    ) {
        LocalDate today = now.atZoneSameInstant(zone).toLocalDate();
        if (today.getDayOfWeek() != DayOfWeek.MONDAY) return Optional.empty();

        LocalDate thisMonday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate from = thisMonday.minusWeeks(1);
        LocalDate to = thisMonday;
        int count = 0;
        for (WatchLogEntity log : logs) {
            LocalDate watched = localDate(log, zone);
            if (!watched.isBefore(from) && watched.isBefore(to)) {
                count += 1;
            }
        }
        if (count <= 0) return Optional.empty();

        String period = weekPeriod(from);
        String title = english
                ? "Your weekly recap is ready"
                : "지난주 기록을 돌아볼 시간이에요";
        String body = english
                ? "You left " + count + " records last week."
                : "지난주 남긴 " + count + "개의 기록을 한 번에 모아보세요.";
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("period", period);
        metadata.put("count", count);
        return Optional.of(new Candidate(
                "WEEKLY_RECAP",
                "weekly_recap:" + period,
                title,
                body,
                "https://ottline.app/me/report?source=android-revisit-reminder&reminder=weekly_recap&period=" + period,
                metadata
        ));
    }

    private Optional<Candidate> sevenDayGapCandidate(
            List<WatchLogEntity> logs,
            OffsetDateTime now,
            ZoneId zone,
            boolean english
    ) {
        if (logs.isEmpty()) return Optional.empty();

        LocalDate today = now.atZoneSameInstant(zone).toLocalDate();
        LocalDate lastLogged = logs.stream()
                .map(log -> localDate(log, zone))
                .max(Comparator.naturalOrder())
                .orElse(null);
        if (lastLogged == null || lastLogged.isAfter(today.minusDays(7))) {
            return Optional.empty();
        }

        String week = weekPeriod(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)));
        String title = english
                ? "It has been a week since your last record"
                : "최근 7일 동안 기록이 비어 있어요";
        String body = english
                ? "If you watched or read something lately, reopen your timeline."
                : "최근 본 작품이 있다면 타임라인을 다시 이어가보세요.";
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("lastLoggedAt", lastLogged.toString());
        return Optional.of(new Candidate(
                "SEVEN_DAY_GAP",
                "seven_day_gap:" + lastLogged + ":" + week,
                title,
                body,
                "https://ottline.app/?quick=1&quick_focus=1&source=android-revisit-reminder&reminder=seven_day_gap",
                metadata
        ));
    }

    private Optional<Candidate> seriesContinueCandidate(
            List<WatchLogEntity> logs,
            OffsetDateTime now,
            ZoneId zone,
            boolean english
    ) {
        LocalDate today = now.atZoneSameInstant(zone).toLocalDate();
        LocalDate earliest = today.minusDays(14);
        LocalDate latest = today.minusDays(2);
        WatchLogEntity match = logs.stream()
                .filter(log -> log.getTitle() != null && log.getTitle().getType() == TitleType.series)
                .filter(log -> log.getStatus() == Status.IN_PROGRESS
                        || log.getSeasonNumber() != null
                        || log.getEpisodeNumber() != null)
                .filter(log -> {
                    LocalDate watched = localDate(log, zone);
                    return !watched.isBefore(earliest) && !watched.isAfter(latest);
                })
                .max(Comparator.comparing(WatchLogEntity::getWatchedAt))
                .orElse(null);
        if (match == null) return Optional.empty();

        String titleName = cleanText(match.getTitle().getName(), 80);
        if (titleName == null) return Optional.empty();

        String episode = episodeLabel(match);
        String week = weekPeriod(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)));
        String title = english
                ? "Continue " + titleName + "?"
                : titleName + " 이어볼까요?";
        String body = english
                ? episode == null ? "Open the series record you left recently." : "Your last series note was " + episode + "."
                : episode == null ? "최근 남긴 시리즈 기록을 다시 열어보세요." : "마지막 시리즈 기록은 " + episode + "였어요.";
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("titleId", match.getTitle().getId().toString());
        if (episode != null) metadata.put("episode", episode);
        return Optional.of(new Candidate(
                "SERIES_CONTINUE",
                "series_continue:" + match.getTitle().getId() + ":" + safeInt(match.getSeasonNumber()) + ":" + safeInt(match.getEpisodeNumber()) + ":" + week,
                title,
                body,
                "https://ottline.app/title/" + match.getTitle().getId() + "?source=android-revisit-reminder&reminder=series_continue",
                metadata
        ));
    }

    private Optional<AndroidReminderCandidateDto> insertDelivery(DeviceRow device, Candidate candidate) {
        UUID deliveryId = UUID.randomUUID();
        List<AndroidReminderCandidateDto> rows = jdbcTemplate.query("""
                insert into android_notification_deliveries (
                    id, android_device_id, user_id, reminder_type, dedupe_key,
                    title, body, deep_link, metadata, created_at
                ) values (?, ?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), now())
                on conflict (user_id, dedupe_key) do nothing
                returning id, reminder_type, title, body, deep_link
                """,
                (rs, rowNum) -> new AndroidReminderCandidateDto(
                        rs.getObject("id", UUID.class),
                        rs.getString("reminder_type"),
                        rs.getString("title"),
                        rs.getString("body"),
                        rs.getString("deep_link")
                ),
                deliveryId,
                device.id(),
                device.userId(),
                candidate.type(),
                candidate.dedupeKey(),
                cleanText(candidate.title(), 160),
                candidate.body(),
                candidate.deepLink(),
                json(candidate.metadata())
        );
        return rows.stream().findFirst();
    }

    private boolean hasDeliveryToday(UUID userId, OffsetDateTime now, ZoneId zone) {
        OffsetDateTime startOfToday = now.atZoneSameInstant(zone)
                .toLocalDate()
                .atStartOfDay(zone)
                .toOffsetDateTime();
        Long count = jdbcTemplate.queryForObject("""
                select count(*)
                from android_notification_deliveries
                where user_id = ?
                  and created_at >= ?
                """,
                Long.class,
                userId,
                startOfToday
        );
        return count != null && count > 0;
    }

    private DeviceRow requireDevice(String tokenHash) {
        return findDevice(tokenHash).orElseThrow(() -> new IllegalArgumentException("Android notification device not found"));
    }

    private Optional<DeviceRow> findDevice(String tokenHash) {
        List<DeviceRow> rows = jdbcTemplate.query("""
                select id, user_id, notification_permission_granted, revisit_reminders_enabled
                from android_notification_devices
                where install_token_hash = ?
                  and revoked_at is null
                """,
                (rs, rowNum) -> new DeviceRow(
                        rs.getObject("id", UUID.class),
                        rs.getObject("user_id", UUID.class),
                        rs.getBoolean("notification_permission_granted"),
                        rs.getBoolean("revisit_reminders_enabled")
                ),
                tokenHash
        );
        return rows.stream().findFirst();
    }

    private String tokenHash(String token) {
        String normalized = cleanText(token, MAX_TOKEN_LENGTH);
        if (normalized == null || normalized.length() < MIN_TOKEN_LENGTH) {
            throw new IllegalArgumentException("Valid Android install token is required");
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(normalized.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    private ZoneId safeZone(String zoneId) {
        String cleaned = cleanText(zoneId, 64);
        if (cleaned == null) return DEFAULT_ZONE;
        try {
            return ZoneId.of(cleaned);
        } catch (Exception ignored) {
            return DEFAULT_ZONE;
        }
    }

    private boolean isEnglish(String locale) {
        String cleaned = cleanText(locale, 16);
        return cleaned != null && cleaned.toLowerCase(Locale.ROOT).startsWith("en");
    }

    private String cleanVersionName(String value) {
        return cleanText(value, 32);
    }

    private String cleanText(String value, int maxLength) {
        if (value == null) return null;
        String cleaned = value.replaceAll("\\s+", " ").trim();
        if (cleaned.isEmpty()) return null;
        return cleaned.length() > maxLength ? cleaned.substring(0, maxLength) : cleaned;
    }

    private LocalDate localDate(WatchLogEntity log, ZoneId zone) {
        return log.getWatchedAt().atZoneSameInstant(zone).toLocalDate();
    }

    private Optional<TopCount> topCount(Map<String, Integer> counts) {
        return counts.entrySet().stream()
                .filter(entry -> entry.getValue() > 0)
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed()
                        .thenComparing(Map.Entry.comparingByKey()))
                .map(entry -> new TopCount(entry.getKey(), entry.getValue()))
                .findFirst();
    }

    private String weekPeriod(LocalDate weekStart) {
        WeekFields weekFields = WeekFields.ISO;
        int year = weekStart.get(weekFields.weekBasedYear());
        int week = weekStart.get(weekFields.weekOfWeekBasedYear());
        return "%d-W%02d".formatted(year, week);
    }

    private String episodeLabel(WatchLogEntity log) {
        Integer season = log.getSeasonNumber();
        Integer episode = log.getEpisodeNumber();
        if (season == null && episode == null) return null;
        if (season == null) return "E" + episode;
        if (episode == null) return "S" + season;
        return "S" + season + " · E" + episode;
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private String json(Map<String, Object> metadata) {
        try {
            return OBJECT_MAPPER.writeValueAsString(metadata);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private record DeviceRow(
            UUID id,
            UUID userId,
            boolean notificationPermissionGranted,
            boolean revisitRemindersEnabled
    ) {}

    private record Candidate(
            String type,
            String dedupeKey,
            String title,
            String body,
            String deepLink,
            Map<String, Object> metadata
    ) {}

    private record TopCount(String label, int count) {}
}
