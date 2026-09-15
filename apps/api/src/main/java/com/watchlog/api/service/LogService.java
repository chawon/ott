package com.watchlog.api.service;

import com.watchlog.api.domain.LogOrigin;
import com.watchlog.api.domain.Occasion;
import com.watchlog.api.domain.Place;
import com.watchlog.api.domain.Status;
import com.watchlog.api.domain.WatchLogEntity;
import com.watchlog.api.dto.CreateWatchLogRequest;
import com.watchlog.api.dto.UpdateWatchLogRequest;
import com.watchlog.api.repo.WatchLogRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class LogService {

    private final WatchLogRepository watchLogRepository;
    private final TitleService titleService;
    private final WatchLogHistoryService historyService;
    private final RecommendationService recommendationService;

    public LogService(
            WatchLogRepository watchLogRepository,
            TitleService titleService,
            WatchLogHistoryService historyService,
            RecommendationService recommendationService
    ) {
        this.watchLogRepository = watchLogRepository;
        this.titleService = titleService;
        this.historyService = historyService;
        this.recommendationService = recommendationService;
    }

    @Transactional(readOnly = true)
    public List<WatchLogEntity> list(
            UUID titleId,
            Status status,
            LogOrigin origin,
            String ott,
            String query,
            Place place,
            Occasion occasion,
            int limit,
            UUID userId,
            boolean sortByHistory
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        return findFiltered(
                titleId, status, origin, ott, query, place, occasion, userId, sortByHistory,
                null, null, null, safeLimit
        );
    }

    @Transactional(readOnly = true)
    public WatchLogPage listPage(
            UUID titleId,
            Status status,
            LogOrigin origin,
            String ott,
            String query,
            Place place,
            Occasion occasion,
            int limit,
            UUID userId,
            boolean sortByHistory,
            String contentType,
            String cursor
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        WatchLogCursor.Decoded decoded;
        try {
            decoded = WatchLogCursor.decode(cursor, sortByHistory);
        } catch (IllegalArgumentException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid log cursor", error);
        }

        var rows = findFiltered(
                titleId, status, origin, ott, query, place, occasion, userId, sortByHistory,
                normalizeContentType(contentType),
                decoded == null ? null : decoded.at(),
                decoded == null ? null : decoded.id(),
                safeLimit + 1
        );
        boolean hasNext = rows.size() > safeLimit;
        var items = List.copyOf(rows.subList(0, Math.min(rows.size(), safeLimit)));
        String nextCursor = null;
        if (hasNext && !items.isEmpty()) {
            var last = items.get(items.size() - 1);
            var cursorAt = sortByHistory ? last.getUpdatedAt() : last.getWatchedAt();
            nextCursor = WatchLogCursor.encode(sortByHistory, cursorAt, last.getId());
        }
        return new WatchLogPage(items, nextCursor);
    }

    private List<WatchLogEntity> findFiltered(
            UUID titleId,
            Status status,
            LogOrigin origin,
            String ott,
            String query,
            Place place,
            Occasion occasion,
            UUID userId,
            boolean sortByHistory,
            String contentType,
            OffsetDateTime cursorAt,
            UUID cursorId,
            int limit
    ) {
        String normalizedOtt = (ott == null || ott.isBlank()) ? null : ott.trim();
        String normalizedQuery = (query == null || query.isBlank()) ? null : query.trim();
        String[] ottPatterns = null;
        if (normalizedOtt != null && normalizedOtt.contains(",")) {
            var parts = java.util.Arrays.stream(normalizedOtt.split(","))
                    .map(String::trim)
                    .filter(v -> !v.isBlank())
                    .map(v -> "%" + v + "%")
                    .toList();
            if (!parts.isEmpty()) {
                ottPatterns = parts.toArray(String[]::new);
            }
        }
        if (ottPatterns != null) {
            return watchLogRepository.findFilteredWithOttPatterns(
                    userId,
                    titleId,
                    status == null ? null : status.name(),
                    origin == null ? null : origin.name(),
                    contentType,
                    ottPatterns,
                    normalizedQuery,
                    place,
                    occasion,
                    cursorAt,
                    cursorId,
                    sortByHistory,
                    PageRequest.of(0, limit)
            );
        }
        return watchLogRepository.findFiltered(
                userId,
                titleId,
                status == null ? null : status.name(),
                origin == null ? null : origin.name(),
                contentType,
                normalizedOtt,
                normalizedQuery,
                place,
                occasion,
                cursorAt,
                cursorId,
                sortByHistory,
                PageRequest.of(0, limit)
        );
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) return null;
        var normalized = contentType.trim().toLowerCase(Locale.ROOT);
        if (normalized.equals("book") || normalized.equals("video")) return normalized;
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "contentType must be book or video");
    }

    public record WatchLogPage(List<WatchLogEntity> items, String nextCursor) {
    }

    @Transactional
    public WatchLogEntity create(CreateWatchLogRequest req, UUID userId, String language) {
        var title = (req.titleId() != null)
                ? titleService.require(req.titleId())
                : (req.provider() != null && req.providerId() != null && "TMDB".equalsIgnoreCase(req.provider()))
                ? titleService.upsertFromTmdb(req.providerId(), req.titleType(), language)
                : (req.provider() != null && req.providerId() != null)
                ? titleService.upsertFromSnapshot(
                        req.provider(),
                        req.providerId(),
                        req.titleType(),
                        req.titleName(),
                        req.year(),
                        req.genres(),
                        req.overview(),
                        req.posterUrl(),
                        req.author(),
                        req.publisher(),
                        req.isbn10(),
                        req.isbn13(),
                        req.pubdate()
                )
                : titleService.createIfNeeded(req.titleType(), req.titleName(), req.year(), req.genres());

        var log = new WatchLogEntity(UUID.randomUUID(), title, req.status());
        if (userId != null) log.setUserId(userId);
        if (req.rating() != null) log.setRating(toRating(req.rating()));
        if (req.note() != null) log.setNote(req.note().trim().isEmpty() ? null : req.note().trim());
        if (req.ott() != null) log.setOtt(req.ott().trim().isEmpty() ? null : req.ott().trim());
        if (req.spoiler() != null) log.setSpoiler(req.spoiler());
        if (req.seasonNumber() != null) log.setSeasonNumber(req.seasonNumber());
        if (req.episodeNumber() != null) log.setEpisodeNumber(req.episodeNumber());
        if (req.seasonPosterUrl() != null) log.setSeasonPosterUrl(req.seasonPosterUrl());
        if (req.seasonYear() != null) log.setSeasonYear(req.seasonYear());
        if (req.origin() != null) log.setOrigin(req.origin());

        log.setWatchedAt(req.watchedAt() != null ? req.watchedAt() : OffsetDateTime.now());
        log.setPlace(req.place());
        log.setOccasion(req.occasion());
        log.setUpdatedAt(OffsetDateTime.now());

        var saved = watchLogRepository.save(log);
        historyService.recordSnapshot(saved);
        if (userId != null) recommendationService.invalidateCache(userId);
        return saved;
    }

    @Transactional
    public WatchLogEntity update(UUID id, UpdateWatchLogRequest req, UUID userId) {
        var log = watchLogRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Log not found: " + id));
        if (userId != null && log.getUserId() != null && !log.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Log not found: " + id);
        }

        if (req.status() != null) log.setStatus(req.status());
        if (req.rating() != null) log.setRating(toRating(req.rating()));
        if (req.note() != null) log.setNote(req.note().trim().isEmpty() ? null : req.note().trim());
        if (req.ott() != null) log.setOtt(req.ott().trim().isEmpty() ? null : req.ott().trim());
        if (req.spoiler() != null) log.setSpoiler(req.spoiler());
        if (req.seasonNumber() != null) log.setSeasonNumber(req.seasonNumber());
        if (req.episodeNumber() != null) log.setEpisodeNumber(req.episodeNumber());
        if (req.seasonPosterUrl() != null) log.setSeasonPosterUrl(req.seasonPosterUrl());
        if (req.seasonYear() != null) log.setSeasonYear(req.seasonYear());
        if (req.origin() != null) log.setOrigin(req.origin());

        if (req.watchedAt() != null) log.setWatchedAt(req.watchedAt());
        if (req.place() != null) log.setPlace(req.place());
        if (req.occasion() != null) log.setOccasion(req.occasion());
        log.setUpdatedAt(OffsetDateTime.now());

        historyService.recordSnapshot(log);
        if (userId != null) recommendationService.invalidateCache(userId);
        return log;
    }

    private static BigDecimal toRating(Double v) {
        if (v == null) return null;
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP);
    }
}
