package com.watchlog.api.dto;

import java.util.List;

public record SyncPullChanges(
        List<SyncLogDto> logs,
        List<SyncTitleDto> titles
) {}
