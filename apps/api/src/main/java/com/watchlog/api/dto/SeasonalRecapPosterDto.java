package com.watchlog.api.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record SeasonalRecapPosterDto(
        UUID titleId,
        String title,
        String titleType,
        String posterUrl,
        int count,
        OffsetDateTime lastLoggedAt
) {}
