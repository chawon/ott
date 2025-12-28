package com.watchlog.api.dto;

import java.time.OffsetDateTime;

public record SyncPushRequest(
        java.util.UUID userId,
        String deviceId,
        OffsetDateTime clientTime,
        SyncChanges changes
) {}
