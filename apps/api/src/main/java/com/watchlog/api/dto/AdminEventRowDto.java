package com.watchlog.api.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminEventRowDto(
        UUID eventId,
        UUID userId,
        String sessionId,
        String eventName,
        String platform,
        String clientVersion,
        String properties,
        OffsetDateTime occurredAt,
        OffsetDateTime createdAt
) {}
