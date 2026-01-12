package com.watchlog.api.dto;

import com.watchlog.api.domain.LogOrigin;
import com.watchlog.api.domain.Occasion;
import com.watchlog.api.domain.Place;
import com.watchlog.api.domain.Status;

import java.time.OffsetDateTime;
import java.util.UUID;

public record SyncLogPayload(
        UUID titleId,
        Status status,
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
