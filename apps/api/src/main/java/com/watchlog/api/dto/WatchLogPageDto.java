package com.watchlog.api.dto;

import java.util.List;

public record WatchLogPageDto(
        List<WatchLogDto> items,
        String nextCursor
) {
}
