package com.watchlog.api.service;

import com.watchlog.api.domain.TitleEntity;
import com.watchlog.api.domain.WatchLogEntity;
import com.watchlog.api.dto.*;
import com.watchlog.api.repo.TitleRepository;
import com.watchlog.api.repo.WatchLogRepository;
import com.watchlog.api.tmdb.TmdbClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class SyncService {

    private final TitleRepository titleRepository;
    private final WatchLogRepository watchLogRepository;
    private final DiscussionService discussionService;
    private final WatchLogHistoryService historyService;
    private final TmdbClient tmdbClient;

    public SyncService(
            TitleRepository titleRepository,
            WatchLogRepository watchLogRepository,
            DiscussionService discussionService,
            WatchLogHistoryService historyService,
            TmdbClient tmdbClient
    ) {
        this.titleRepository = titleRepository;
        this.watchLogRepository = watchLogRepository;
        this.discussionService = discussionService;
        this.historyService = historyService;
        this.tmdbClient = tmdbClient;
    }

    @Transactional
    public SyncPushResponse push(SyncPushRequest req) {
        List<UUID> accepted = new ArrayList<>();
        List<SyncReject> rejected = new ArrayList<>();
        Map<UUID, UUID> titleIdMap = new HashMap<>();
        UUID reqUserId = (req == null) ? null : req.userId();

        if (req != null && req.changes() != null) {
            var changes = req.changes();
            if (changes.titles() != null) {
                for (var c : changes.titles()) {
                    applyTitleChange(c, accepted, rejected, titleIdMap);
                }
            }
            if (changes.logs() != null) {
                for (var c : changes.logs()) {
                    applyLogChange(c, accepted, rejected, titleIdMap, reqUserId);
                }
            }
        }

        return new SyncPushResponse(accepted, rejected);
    }

    @Transactional(readOnly = true)
    public SyncPullResponse pull(OffsetDateTime since, UUID userId) {
        OffsetDateTime checkpoint = (since == null) ? OffsetDateTime.parse("1970-01-01T00:00:00Z") : since;

        var titles = titleRepository.findByUpdatedAtAfterOrDeletedAtAfter(checkpoint, checkpoint)
                .stream().map(SyncTitleDto::from).toList();
        var logs = (userId == null)
                ? watchLogRepository.findByUpdatedAtAfterOrDeletedAtAfter(checkpoint, checkpoint).stream().map(SyncLogDto::from).toList()
                : watchLogRepository.findUserChangesAfter(userId, checkpoint).stream().map(SyncLogDto::from).toList();

        return new SyncPullResponse(OffsetDateTime.now(), new SyncPullChanges(logs, titles));
    }

    private void applyTitleChange(SyncChange<SyncTitlePayload> change,
                                  List<UUID> accepted,
                                  List<SyncReject> rejected,
                                  Map<UUID, UUID> titleIdMap) {
        if (change == null || change.id() == null || change.updatedAt() == null) return;
        String op = change.op() == null ? "upsert" : change.op();
        var payload = change.payload();

        if (payload != null && payload.provider() != null && payload.providerId() != null) {
            var byProvider = titleRepository.findByProviderAndProviderId(payload.provider(), payload.providerId());
            if (byProvider.isPresent()) {
                var existing = byProvider.get();
                titleIdMap.put(change.id(), existing.getId());
                if (isStale(existing.getUpdatedAt(), existing.getDeletedAt(), change.updatedAt())) {
                    rejected.add(new SyncReject(change.id(), "stale"));
                    return;
                }
                if ("delete".equalsIgnoreCase(op)) {
                    existing.setDeletedAt(change.updatedAt());
                    existing.setUpdatedAt(change.updatedAt());
                    accepted.add(change.id());
                    return;
                }
                existing.setUpdatedAt(change.updatedAt());
                existing.setDeletedAt(null);
                existing.setYear(payload.year());
                existing.setOverview(payload.overview());
                existing.setPosterUrl(payload.posterUrl());
                if (payload.genres() != null) {
                    existing.setGenres(payload.genres().toArray(String[]::new));
                }
                if (payload.directors() != null) {
                    existing.setDirectors(payload.directors().toArray(String[]::new));
                }
                if (payload.cast() != null) {
                    existing.setCastNames(payload.cast().toArray(String[]::new));
                }
                if (payload.type() != null) existing.setType(payload.type());
                if (payload.name() != null && !payload.name().isBlank()) existing.setName(payload.name().trim());
                hydrateFromTmdbIfNeeded(existing, payload);
                accepted.add(change.id());
                return;
            }
        }

        var existingOpt = titleRepository.findById(change.id());
        if (existingOpt.isPresent()) {
            var existing = existingOpt.get();
            if (isStale(existing.getUpdatedAt(), existing.getDeletedAt(), change.updatedAt())) {
                rejected.add(new SyncReject(change.id(), "stale"));
                return;
            }
            if ("delete".equalsIgnoreCase(op)) {
                existing.setDeletedAt(change.updatedAt());
                existing.setUpdatedAt(change.updatedAt());
                accepted.add(existing.getId());
                return;
            }

            if (payload != null) {
                existing.setUpdatedAt(change.updatedAt());
                existing.setDeletedAt(null);
                existing.setYear(payload.year());
                existing.setOverview(payload.overview());
                existing.setPosterUrl(payload.posterUrl());
                if (payload.genres() != null) {
                    existing.setGenres(payload.genres().toArray(String[]::new));
                }
                if (payload.directors() != null) {
                    existing.setDirectors(payload.directors().toArray(String[]::new));
                }
                if (payload.cast() != null) {
                    existing.setCastNames(payload.cast().toArray(String[]::new));
                }
                if (payload.provider() != null) existing.setProvider(payload.provider());
                if (payload.providerId() != null) existing.setProviderId(payload.providerId());
                if (payload.type() != null) existing.setType(payload.type());
                if (payload.name() != null && !payload.name().isBlank()) existing.setName(payload.name().trim());
                hydrateFromTmdbIfNeeded(existing, payload);
            }
            accepted.add(existing.getId());
            discussionService.ensureForTitle(existing);
            return;
        }

        if ("delete".equalsIgnoreCase(op)) {
            rejected.add(new SyncReject(change.id(), "not_found"));
            return;
        }

        if (payload == null) {
            rejected.add(new SyncReject(change.id(), "invalid_title_payload"));
            return;
        }
        if (payload.name() == null || payload.name().isBlank()) {
            if (payload.provider() != null && payload.providerId() != null
                    && "TMDB".equalsIgnoreCase(payload.provider())
                    && payload.type() != null) {
                try {
                    var snapshot = tmdbClient.fetchDetails(payload.type(), payload.providerId());
                    payload = new SyncTitlePayload(
                            snapshot.type(),
                            snapshot.name(),
                            snapshot.year(),
                            snapshot.genres(),
                            snapshot.directors(),
                            snapshot.cast(),
                            snapshot.overview(),
                            snapshot.posterUrl(),
                            payload.provider(),
                            payload.providerId()
                    );
                } catch (Exception e) {
                    rejected.add(new SyncReject(change.id(), "invalid_title_payload"));
                    return;
                }
            } else {
                rejected.add(new SyncReject(change.id(), "invalid_title_payload"));
                return;
            }
        }

        var created = new TitleEntity(change.id(), payload.type(), payload.name().trim());
        created.setYear(payload.year());
        created.setOverview(payload.overview());
        created.setPosterUrl(payload.posterUrl());
        if (payload.genres() != null) {
            created.setGenres(payload.genres().toArray(String[]::new));
        }
        if (payload.directors() != null) {
            created.setDirectors(payload.directors().toArray(String[]::new));
        }
        if (payload.cast() != null) {
            created.setCastNames(payload.cast().toArray(String[]::new));
        }
        if (payload.provider() != null) created.setProvider(payload.provider());
        if (payload.providerId() != null) created.setProviderId(payload.providerId());
        created.setUpdatedAt(change.updatedAt());
        hydrateFromTmdbIfNeeded(created, payload);
        titleRepository.save(created);
        accepted.add(created.getId());
    }

    private void applyLogChange(SyncChange<SyncLogPayload> change,
                                List<UUID> accepted,
                                List<SyncReject> rejected,
                                Map<UUID, UUID> titleIdMap,
                                UUID reqUserId) {
        if (change == null || change.id() == null || change.updatedAt() == null) return;
        String op = change.op() == null ? "upsert" : change.op();

        var existingOpt = watchLogRepository.findById(change.id());
        if (existingOpt.isPresent()) {
            var existing = existingOpt.get();
            if (isStale(existing.getUpdatedAt(), existing.getDeletedAt(), change.updatedAt())) {
                rejected.add(new SyncReject(change.id(), "stale"));
                return;
            }
            if ("delete".equalsIgnoreCase(op)) {
                existing.setDeletedAt(change.updatedAt());
                existing.setUpdatedAt(change.updatedAt());
                accepted.add(existing.getId());
                return;
            }

            var payload = change.payload();
            if (payload != null) {
                existing.setUpdatedAt(change.updatedAt());
                existing.setDeletedAt(null);
                if (payload.status() != null) existing.setStatus(payload.status());
                if (payload.rating() != null) existing.setRating(BigDecimal.valueOf(payload.rating()));
                if (payload.note() != null) existing.setNote(payload.note());
                if (payload.spoiler() != null) existing.setSpoiler(payload.spoiler());
                if (payload.ott() != null) existing.setOtt(payload.ott());
                if (payload.seasonNumber() != null) existing.setSeasonNumber(payload.seasonNumber());
                if (payload.episodeNumber() != null) existing.setEpisodeNumber(payload.episodeNumber());
                if (payload.seasonPosterUrl() != null) existing.setSeasonPosterUrl(payload.seasonPosterUrl());
                if (payload.seasonYear() != null) existing.setSeasonYear(payload.seasonYear());
                if (payload.watchedAt() != null) existing.setWatchedAt(payload.watchedAt());
                if (payload.place() != null) existing.setPlace(payload.place());
                if (payload.occasion() != null) existing.setOccasion(payload.occasion());
            }
            historyService.recordSnapshot(existing);
            accepted.add(existing.getId());
            return;
        }

        if ("delete".equalsIgnoreCase(op)) {
            rejected.add(new SyncReject(change.id(), "not_found"));
            return;
        }

        var payload = change.payload();
        if (payload == null || payload.titleId() == null || payload.status() == null) {
            rejected.add(new SyncReject(change.id(), "invalid_log_payload"));
            return;
        }

        UUID resolvedTitleId = titleIdMap.getOrDefault(payload.titleId(), payload.titleId());
        var title = titleRepository.findById(resolvedTitleId);
        if (title.isEmpty()) {
            rejected.add(new SyncReject(change.id(), "title_missing"));
            return;
        }

        UUID userId = reqUserId;
        var existingByTitle = (userId == null)
                ? watchLogRepository.findByTitle_IdAndDeletedAtIsNull(resolvedTitleId)
                : watchLogRepository.findByTitle_IdAndUserIdAndDeletedAtIsNull(resolvedTitleId, userId);
        if (existingByTitle.isPresent()) {
            var existing = existingByTitle.get();
            if (isStale(existing.getUpdatedAt(), existing.getDeletedAt(), change.updatedAt())) {
                rejected.add(new SyncReject(change.id(), "stale"));
                return;
            }
            existing.setUpdatedAt(change.updatedAt());
            existing.setDeletedAt(null);
            existing.setStatus(payload.status());
            if (payload.rating() != null) existing.setRating(BigDecimal.valueOf(payload.rating()));
            if (payload.note() != null) existing.setNote(payload.note());
            if (payload.spoiler() != null) existing.setSpoiler(payload.spoiler());
            if (payload.ott() != null) existing.setOtt(payload.ott());
            if (payload.seasonNumber() != null) existing.setSeasonNumber(payload.seasonNumber());
            if (payload.episodeNumber() != null) existing.setEpisodeNumber(payload.episodeNumber());
            if (payload.seasonPosterUrl() != null) existing.setSeasonPosterUrl(payload.seasonPosterUrl());
            if (payload.seasonYear() != null) existing.setSeasonYear(payload.seasonYear());
            if (payload.watchedAt() != null) existing.setWatchedAt(payload.watchedAt());
            existing.setPlace(payload.place());
            existing.setOccasion(payload.occasion());
            historyService.recordSnapshot(existing);
            accepted.add(change.id());
            return;
        }

        var created = new WatchLogEntity(change.id(), title.get(), payload.status());
        if (userId != null) created.setUserId(userId);
        if (payload.rating() != null) created.setRating(BigDecimal.valueOf(payload.rating()));
        if (payload.note() != null) created.setNote(payload.note());
        if (payload.spoiler() != null) created.setSpoiler(payload.spoiler());
        if (payload.ott() != null) created.setOtt(payload.ott());
        if (payload.seasonNumber() != null) created.setSeasonNumber(payload.seasonNumber());
        if (payload.episodeNumber() != null) created.setEpisodeNumber(payload.episodeNumber());
        if (payload.seasonPosterUrl() != null) created.setSeasonPosterUrl(payload.seasonPosterUrl());
        if (payload.seasonYear() != null) created.setSeasonYear(payload.seasonYear());
        if (payload.watchedAt() != null) created.setWatchedAt(payload.watchedAt());
        created.setPlace(payload.place());
        created.setOccasion(payload.occasion());
        created.setUpdatedAt(change.updatedAt());
        watchLogRepository.save(created);
        historyService.recordSnapshot(created);
        discussionService.ensureForTitle(title.get());
        accepted.add(created.getId());
    }

    private boolean isStale(OffsetDateTime updatedAt, OffsetDateTime deletedAt, OffsetDateTime incoming) {
        if (deletedAt != null && deletedAt.isAfter(incoming)) return true;
        return updatedAt != null && updatedAt.isAfter(incoming);
    }

    private void hydrateFromTmdbIfNeeded(TitleEntity entity, SyncTitlePayload payload) {
        if (payload == null) return;
        if (payload.provider() == null || payload.providerId() == null) return;
        if (!"TMDB".equalsIgnoreCase(payload.provider())) return;

        boolean payloadHasCredits = (payload.directors() != null && !payload.directors().isEmpty())
                || (payload.cast() != null && !payload.cast().isEmpty());
        boolean entityHasCredits = (entity.getDirectors() != null && entity.getDirectors().length > 0)
                || (entity.getCastNames() != null && entity.getCastNames().length > 0);
        if (payloadHasCredits || entityHasCredits) return;

        var type = payload.type() != null ? payload.type() : entity.getType();
        if (type == null) return;

        try {
            var snapshot = tmdbClient.fetchDetails(type, payload.providerId());
            entity.setType(snapshot.type());
            entity.setName(snapshot.name());
            entity.setYear(snapshot.year());
            entity.setOverview(snapshot.overview());
            entity.setPosterUrl(snapshot.posterUrl());
            if (snapshot.genres() != null) {
                entity.setGenres(snapshot.genres().toArray(String[]::new));
            }
            if (snapshot.directors() != null) {
                entity.setDirectors(snapshot.directors().toArray(String[]::new));
            }
            if (snapshot.cast() != null) {
                entity.setCastNames(snapshot.cast().toArray(String[]::new));
            }
        } catch (Exception ignored) {
        }
    }
}
