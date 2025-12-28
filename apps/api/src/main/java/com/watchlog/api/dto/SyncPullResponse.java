package com.watchlog.api.dto;

import java.time.OffsetDateTime;

public record SyncPullResponse(
        OffsetDateTime serverTime,
        SyncPullChanges changes
) {}
