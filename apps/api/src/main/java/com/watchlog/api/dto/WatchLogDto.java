package com.watchlog.api.dto;

import com.watchlog.api.domain.Occasion;
import com.watchlog.api.domain.Place;
import com.watchlog.api.domain.Status;
import com.watchlog.api.domain.WatchLogEntity;

import java.time.OffsetDateTime;
import java.util.UUID;

public record WatchLogDto(
        UUID id,
        TitleDto title,
        Status status,
        Double rating,
        String note,
        boolean spoiler,
        String ott,
        Integer seasonNumber,
        Integer episodeNumber,
        String seasonPosterUrl,
        Integer seasonYear,
        OffsetDateTime watchedAt,
        Place place,
        Occasion occasion,
        OffsetDateTime createdAt
) {
    public static WatchLogDto from(WatchLogEntity e) {
        return new WatchLogDto(
                e.getId(),
                TitleDto.from(e.getTitle()),
                e.getStatus(),
                e.getRating() == null ? null : e.getRating().doubleValue(),
                e.getNote(),
                e.isSpoiler(),
                e.getOtt(),
                e.getSeasonNumber(),
                e.getEpisodeNumber(),
                e.getSeasonPosterUrl(),
                e.getSeasonYear(),
                e.getWatchedAt(),
                e.getPlace(),
                e.getOccasion(),
                e.getCreatedAt()
        );
    }
}
