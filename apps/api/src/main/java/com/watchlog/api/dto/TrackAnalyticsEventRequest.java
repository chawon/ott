package com.watchlog.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record TrackAnalyticsEventRequest(
        UUID eventId,
        @NotBlank(message = "eventName is required")
        @Pattern(regexp = "^[a-z0-9_]{2,64}$", message = "eventName must match ^[a-z0-9_]{2,64}$")
        String eventName,
        @NotBlank(message = "platform is required")
        @Pattern(regexp = "^(web|pwa|twa)$", message = "platform must be one of web, pwa, twa")
        String platform,
        @Size(max = 128, message = "sessionId must be <= 128 chars")
        String sessionId,
        @Size(max = 64, message = "clientVersion must be <= 64 chars")
        String clientVersion,
        OffsetDateTime occurredAt,
        Map<String, Object> properties
) {}
