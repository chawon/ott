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
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class SyncService {

    private final TitleRepository titleRepository;
    private final WatchLogRepository watchLogRepository;
    private final WatchLogHistoryService historyService;
    private final TmdbClient tmdbClient;
    private final SyncDeliveryStore deliveryStore;

    public SyncService(
            TitleRepository titleRepository,
            WatchLogRepository watchLogRepository,
            WatchLogHistoryService historyService,
            TmdbClient tmdbClient,
            SyncDeliveryStore deliveryStore
    ) {
        this.titleRepository = titleRepository;
        this.watchLogRepository = watchLogRepository;
        this.historyService = historyService;
        this.tmdbClient = tmdbClient;
        this.deliveryStore = deliveryStore;
    }

    @Transactional
    public SyncPushResponse push(SyncPushRequest req, String language) {
        List<UUID> accepted = new ArrayList<>();
        List<SyncReject> rejected = new ArrayList<>();
        Map<UUID, UUID> titleIdMap = new HashMap<>();
        UUID reqUserId = (req == null) ? null : req.userId();
        deliveryStore.lockPush(reqUserId);

        if (req != null && req.changes() != null) {
            var changes = req.changes();
            if (changes.titles() != null) {
                for (var c : changes.titles()) {
                    applyTitleChange(databaseTime(c), accepted, rejected, titleIdMap, language);
                }
            }
            if (changes.logs() != null) {
                for (var c : changes.logs()) {
                    applyLogChange(databaseTime(c), accepted, rejected, titleIdMap, reqUserId);
                }
            }
        }

        return new SyncPushResponse(accepted, rejected);
    }

    @Transactional
    public SyncPullResponse pull(OffsetDateTime since, UUID userId) {
        return pull(since, userId, null);
    }

    @Transactional
    public SyncPullResponse pull(OffsetDateTime since, UUID userId, UUID deviceId) {
        watchLogRepository.flush();
        var window = deliveryStore.preparePull(since, userId, deviceId);
        var logs = watchLogRepository.findForSyncDelivery(userId, window.since()).stream().map(SyncLogDto::from).toList();
        var titles = new LinkedHashMap<UUID, SyncTitleDto>();
        for (var title : titleRepository.findForSyncDelivery(window.since())) {
            titles.put(title.getId(), SyncTitleDto.from(title));
        }
        // A log can reference an unchanged, backdated title, or commit between the reads.
        // Deliver its actual canonical title as well; clients must never need an Unknown fallback.
        var required = logs.stream().map(SyncLogDto::titleId).filter(id -> !titles.containsKey(id)).distinct().toList();
        for (var title : titleRepository.findAllById(required)) {
            titles.put(title.getId(), SyncTitleDto.from(title));
        }
        return new SyncPullResponse(window.serverTime(), new SyncPullChanges(logs, List.copyOf(titles.values())));
    }

    private void applyTitleChange(SyncChange<SyncTitlePayload> change,
                                  List<UUID> accepted,
                                  List<SyncReject> rejected,
                                  Map<UUID, UUID> titleIdMap,
                                  String language) {
        if (change == null || change.id() == null || change.updatedAt() == null) return;
        String op = change.op() == null ? "upsert" : change.op();
        var payload = change.payload();

        if (payload != null && payload.provider() != null && payload.providerId() != null) {
            var byProvider = "delete".equalsIgnoreCase(op)
                    ? titleRepository.findByProviderAndProviderId(payload.provider(), payload.providerId())
                    : titleRepository.resolveExternalTitle(payload.provider(), payload.providerId(), payload.type(),
                            payload.isbn10(), payload.isbn13());
            if (byProvider.isPresent()) {
                var existing = byProvider.get();
                titleIdMap.put(change.id(), existing.getId());
                if (isStale(existing.getUpdatedAt(), existing.getDeletedAt(), change.updatedAt())) {
                    rejected.add(new SyncReject(change.id(), "stale"));
                    return;
                }
                if (handleEqualTitle(existing, change, change.id(), accepted, rejected)) return;
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
                existing.setAuthor(payload.author());
                existing.setPublisher(payload.publisher());
                existing.setIsbn10(payload.isbn10());
                existing.setIsbn13(payload.isbn13());
                existing.setPubdate(payload.pubdate());
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
                hydrateFromTmdbIfNeeded(existing, payload, language);
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
            if (handleEqualTitle(existing, change, existing.getId(), accepted, rejected)) return;
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
                existing.setAuthor(payload.author());
                existing.setPublisher(payload.publisher());
                existing.setIsbn10(payload.isbn10());
                existing.setIsbn13(payload.isbn13());
                existing.setPubdate(payload.pubdate());
                if (payload.genres() != null) {
                    existing.setGenres(payload.genres().toArray(String[]::new));
                }
                if (payload.directors() != null) {
                    existing.setDirectors(payload.directors().toArray(String[]::new));
                }
                if (payload.cast() != null) {
                    existing.setCastNames(payload.cast().toArray(String[]::new));
                }
                // Older native clients map unknown providers to LOCAL when recording a shared title.
                // Their titleId still points to the canonical book, whose identity must survive that fallback.
                boolean canonicalBook = existing.getType() == com.watchlog.api.domain.TitleType.book
                        && ("NAVER".equals(existing.getProvider()) || "KAKAO".equals(existing.getProvider())
                            || "GOOGLE_BOOKS".equals(existing.getProvider()));
                if (!canonicalBook) {
                    if (payload.provider() != null) existing.setProvider(payload.provider());
                    if (payload.providerId() != null) existing.setProviderId(payload.providerId());
                }
                if (payload.type() != null) existing.setType(payload.type());
                if (payload.name() != null && !payload.name().isBlank()) existing.setName(payload.name().trim());
                hydrateFromTmdbIfNeeded(existing, payload, language);
            }
            accepted.add(existing.getId());
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
                    var snapshot = tmdbClient.fetchDetails(payload.type(), payload.providerId(), language);
                    payload = new SyncTitlePayload(
                            snapshot.type(),
                            snapshot.name(),
                            snapshot.year(),
                            snapshot.genres(),
                            snapshot.directors(),
                            snapshot.cast(),
                            snapshot.overview(),
                            snapshot.posterUrl(),
                            null,
                            null,
                            null,
                            null,
                            null,
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
        created.setAuthor(payload.author());
        created.setPublisher(payload.publisher());
        created.setIsbn10(payload.isbn10());
        created.setIsbn13(payload.isbn13());
        created.setPubdate(payload.pubdate());
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
        hydrateFromTmdbIfNeeded(created, payload, language);
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
            if (handleEqualLog(existing, change, false, existing.getId(), accepted, rejected)) return;
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
                if (payload.origin() != null) existing.setOrigin(payload.origin());
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
            if (handleEqualLog(existing, change, true, change.id(), accepted, rejected)) return;
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
            if (payload.origin() != null) existing.setOrigin(payload.origin());
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
        if (payload.origin() != null) created.setOrigin(payload.origin());
        if (payload.watchedAt() != null) created.setWatchedAt(payload.watchedAt());
        created.setPlace(payload.place());
        created.setOccasion(payload.occasion());
        created.setUpdatedAt(change.updatedAt());
        watchLogRepository.save(created);
        historyService.recordSnapshot(created);
        accepted.add(created.getId());
    }

    private boolean isStale(OffsetDateTime updatedAt, OffsetDateTime deletedAt, OffsetDateTime incoming) {
        if (deletedAt != null && deletedAt.isAfter(incoming)) return true;
        return updatedAt != null && updatedAt.isAfter(incoming);
    }

    private static OffsetDateTime databaseTime(OffsetDateTime value) {
        if (value == null) return null;
        long micros = (value.getNano() + 500L) / 1000L;
        return micros == 1_000_000 ? value.withNano(0).plusSeconds(1) : value.withNano((int) micros * 1000);
    }

    private static <T> SyncChange<T> databaseTime(SyncChange<T> change) {
        return change == null ? null : new SyncChange<>(change.id(), change.op(), databaseTime(change.updatedAt()), change.payload());
    }

    private static boolean sameTime(OffsetDateTime left, OffsetDateTime right) {
        return left != null && right != null && left.isEqual(databaseTime(right));
    }

    private static <T> boolean unchanged(T incoming, T stored) {
        return incoming == null || Objects.equals(incoming, stored);
    }

    private static boolean unchanged(OffsetDateTime incoming, OffsetDateTime stored) {
        return incoming == null || sameTime(stored, incoming);
    }

    private boolean handleEqualLog(WatchLogEntity existing, SyncChange<SyncLogPayload> change,
                                   boolean replaceTpo, UUID acceptedId, List<UUID> accepted, List<SyncReject> rejected) {
        if (!sameTime(existing.getUpdatedAt(), change.updatedAt())) return false;
        var p = change.payload();
        boolean deleting = "delete".equalsIgnoreCase(change.op());
        boolean same = deleting ? sameTime(existing.getDeletedAt(), change.updatedAt()) : existing.getDeletedAt() == null
                && (p == null || (unchanged(p.status(), existing.getStatus())
                && (p.rating() == null || existing.getRating() != null && existing.getRating().compareTo(
                    BigDecimal.valueOf(p.rating()).setScale(1, RoundingMode.HALF_UP)) == 0)
                && unchanged(p.note(), existing.getNote()) && unchanged(p.spoiler(), existing.isSpoiler())
                && unchanged(p.ott(), existing.getOtt()) && unchanged(p.seasonNumber(), existing.getSeasonNumber())
                && unchanged(p.episodeNumber(), existing.getEpisodeNumber())
                && unchanged(p.seasonPosterUrl(), existing.getSeasonPosterUrl()) && unchanged(p.seasonYear(), existing.getSeasonYear())
                && unchanged(p.origin(), existing.getOrigin()) && unchanged(p.watchedAt(), existing.getWatchedAt())
                && (replaceTpo ? Objects.equals(p.place(), existing.getPlace()) : unchanged(p.place(), existing.getPlace()))
                && (replaceTpo ? Objects.equals(p.occasion(), existing.getOccasion()) : unchanged(p.occasion(), existing.getOccasion()))));
        // Identical replays acknowledge without another row update, receipt or history entry.
        // A different payload at the same logical instant cannot overwrite the committed version.
        if (same) accepted.add(acceptedId);
        else rejected.add(new SyncReject(change.id(), "stale"));
        return true;
    }

    private boolean handleEqualTitle(TitleEntity existing, SyncChange<SyncTitlePayload> change,
                                     UUID acceptedId, List<UUID> accepted, List<SyncReject> rejected) {
        if (!sameTime(existing.getUpdatedAt(), change.updatedAt())) return false;
        // Catalog hydration may have changed the original payload's name, year, images or credits.
        // At the same logical version retain canonical metadata and acknowledge resolution.
        // Do not compare the wire snapshot with the enriched row or re-run the network request.
        boolean same = "delete".equalsIgnoreCase(change.op()) ? sameTime(existing.getDeletedAt(), change.updatedAt())
                : existing.getDeletedAt() == null;
        if (same) accepted.add(acceptedId);
        else rejected.add(new SyncReject(change.id(), "stale"));
        return true;
    }

    private void hydrateFromTmdbIfNeeded(TitleEntity entity, SyncTitlePayload payload, String language) {
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
            var snapshot = tmdbClient.fetchDetails(type, payload.providerId(), language);
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
