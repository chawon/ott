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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class LogService {

    private final WatchLogRepository watchLogRepository;
    private final TitleService titleService;
    private final WatchLogHistoryService historyService;
    private final DiscussionService discussionService;

    public LogService(
            WatchLogRepository watchLogRepository,
            TitleService titleService,
            WatchLogHistoryService historyService,
            DiscussionService discussionService
    ) {
        this.watchLogRepository = watchLogRepository;
        this.titleService = titleService;
        this.historyService = historyService;
        this.discussionService = discussionService;
    }

    @Transactional(readOnly = true)
    public List<WatchLogEntity> list(UUID titleId, Status status, LogOrigin origin, String ott, Place place, Occasion occasion, int limit, UUID userId) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        return watchLogRepository.findFiltered(
                userId,
                titleId,
                status == null ? null : status.name(),
                origin == null ? null : origin.name(),
                (ott == null || ott.isBlank()) ? null : ott.trim(),
                place,
                occasion,
                PageRequest.of(0, safeLimit)
        );
    }

    @Transactional
    public WatchLogEntity create(CreateWatchLogRequest req, UUID userId) {
        var title = (req.titleId() != null)
                ? titleService.require(req.titleId())
                : (req.provider() != null && req.providerId() != null && "TMDB".equalsIgnoreCase(req.provider()))
                ? titleService.upsertFromTmdb(req.providerId(), req.titleType())
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
        discussionService.ensureForTitle(title);
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
        return log;
    }

    private static BigDecimal toRating(Double v) {
        if (v == null) return null;
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP);
    }
}
