package com.watchlog.api.dto;

import com.watchlog.api.domain.TitleType;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record CuratedContentAdminDto(
        UUID id,
        UUID titleId,
        String titleName,
        TitleType titleType,
        Integer titleYear,
        String posterUrl,
        String locale,
        String kind,
        String body,
        String status,
        String actorKey,
        String actorType,
        String actorDisplayName,
        String disclosure,
        String model,
        String promptVersion,
        Map<String, Object> sourceJson,
        OffsetDateTime publishedAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
