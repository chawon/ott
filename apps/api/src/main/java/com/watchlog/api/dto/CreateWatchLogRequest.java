package com.watchlog.api.dto;

import com.watchlog.api.domain.LogOrigin;
import com.watchlog.api.domain.Occasion;
import com.watchlog.api.domain.Place;
import com.watchlog.api.domain.Status;
import com.watchlog.api.domain.TitleType;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record CreateWatchLogRequest(
        UUID titleId,
        String provider,
        String providerId,

        TitleType titleType,
        String titleName,
        Integer year,
        List<String> genres,
        String overview,
        String posterUrl,
        String author,
        String publisher,
        String isbn10,
        String isbn13,
        String pubdate,

        @NotNull Status status,
        Double rating,
        String note,
        Boolean spoiler,
        String ott,

        Integer seasonNumber,
        Integer episodeNumber,
        String seasonPosterUrl,
        Integer seasonYear,
        LogOrigin origin,

        OffsetDateTime watchedAt,
        Place place,
        Occasion occasion
) {}
