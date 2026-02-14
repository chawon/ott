package com.watchlog.api.dto;

public record AdminDimensionSummaryDto(
        String key,
        long events,
        long activeUsers
) {}
