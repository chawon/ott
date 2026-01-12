package com.watchlog.api.dto;

import com.watchlog.api.domain.LogOrigin;
import com.watchlog.api.domain.Occasion;
import com.watchlog.api.domain.Place;
import com.watchlog.api.domain.Status;
import com.watchlog.api.domain.WatchLogHistoryEntity;

import java.time.OffsetDateTime;
import java.util.UUID;

public record WatchLogHistoryDto(
        UUID id,
        UUID logId,
        OffsetDateTime recordedAt,
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
        Occasion occasion
) {
    public static WatchLogHistoryDto from(WatchLogHistoryEntity e) {
        return new WatchLogHistoryDto(
                e.getId(),
                e.getLog().getId(),
                e.getRecordedAt(),
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
                e.getOccasion()
        );
    }
}
