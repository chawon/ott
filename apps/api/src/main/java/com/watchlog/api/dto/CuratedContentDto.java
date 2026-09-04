package com.watchlog.api.dto;

import com.watchlog.api.domain.TitleType;

import java.time.OffsetDateTime;
import java.util.UUID;

public record CuratedContentDto(
        UUID id,
        UUID titleId,
        String titleName,
        TitleType titleType,
        Integer titleYear,
        String posterUrl,
        String kind,
        String body,
        String actorKey,
        String actorType,
        String actorDisplayName,
        String disclosure,
        OffsetDateTime publishedAt
) {}
