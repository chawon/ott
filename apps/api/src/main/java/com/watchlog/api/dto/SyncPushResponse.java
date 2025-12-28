package com.watchlog.api.dto;

import java.util.List;
import java.util.UUID;

public record SyncPushResponse(
        List<UUID> accepted,
        List<SyncReject> rejected
) {}
