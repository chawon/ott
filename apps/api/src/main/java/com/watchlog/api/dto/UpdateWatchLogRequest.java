package com.watchlog.api.dto;

import com.watchlog.api.domain.Occasion;
import com.watchlog.api.domain.Place;
import com.watchlog.api.domain.Status;

import java.time.OffsetDateTime;

public record UpdateWatchLogRequest(
        Status status,
        Double rating,
        String note,
        Boolean spoiler,
        String ott,
        OffsetDateTime watchedAt,
        Place place,
        Occasion occasion
) {}
