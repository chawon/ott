package com.watchlog.api.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record SyncChange<T>(
        UUID id,
        String op,
        OffsetDateTime updatedAt,
        T payload
) {}
