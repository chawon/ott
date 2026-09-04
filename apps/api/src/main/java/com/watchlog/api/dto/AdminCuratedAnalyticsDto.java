package com.watchlog.api.dto;

import java.time.OffsetDateTime;

public record AdminCuratedAnalyticsDto(
        int days,
        OffsetDateTime from,
        OffsetDateTime to,
        long impressions,
        long opens,
        long humanActions,
        long humanActionActors
) {}
