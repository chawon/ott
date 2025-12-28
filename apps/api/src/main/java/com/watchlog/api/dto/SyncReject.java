package com.watchlog.api.dto;

import java.util.UUID;

public record SyncReject(
        UUID id,
        String reason
) {}
