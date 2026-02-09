package com.watchlog.api.dto;

public record AdminPlatformSummaryDto(
        String platform,
        long events,
        long activeUsers
) {}
