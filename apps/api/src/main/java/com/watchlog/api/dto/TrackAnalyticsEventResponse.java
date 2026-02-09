package com.watchlog.api.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record TrackAnalyticsEventResponse(
        UUID eventId,
        boolean accepted,
        OffsetDateTime occurredAt
) {}
