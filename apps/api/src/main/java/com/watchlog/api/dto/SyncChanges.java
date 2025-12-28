package com.watchlog.api.dto;

import java.util.List;

public record SyncChanges(
        List<SyncChange<SyncLogPayload>> logs,
        List<SyncChange<SyncTitlePayload>> titles
) {}
