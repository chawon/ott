package com.watchlog.api.dto;

import com.watchlog.api.domain.LogOrigin;
import com.watchlog.api.domain.Occasion;
import com.watchlog.api.domain.Place;
import com.watchlog.api.domain.Status;
import com.watchlog.api.domain.WatchLogEntity;

import java.time.OffsetDateTime;
import java.util.UUID;

public record SyncLogDto(
        UUID id,
        UUID titleId,
        Status status,
        Double rating,
        String note,
        boolean spoiler,
        String ott,
        Integer seasonNumber,
        Integer episodeNumber,
        String seasonPosterUrl,
        Integer seasonYear,
        LogOrigin origin,
        OffsetDateTime watchedAt,
        Place place,
        Occasion occasion,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        OffsetDateTime deletedAt
) {
    public static SyncLogDto from(WatchLogEntity e) {
        return new SyncLogDto(
                e.getId(),
                e.getTitle().getId(),
                e.getStatus(),
                e.getRating() == null ? null : e.getRating().doubleValue(),
                e.getNote(),
                e.isSpoiler(),
                e.getOtt(),
                e.getSeasonNumber(),
                e.getEpisodeNumber(),
                e.getSeasonPosterUrl(),
                e.getSeasonYear(),
                e.getOrigin(),
                e.getWatchedAt(),
                e.getPlace(),
                e.getOccasion(),
                e.getCreatedAt(),
                e.getUpdatedAt(),
                e.getDeletedAt()
        );
    }
}
