package com.watchlog.api.dto;

public record AdminAcquisitionDimensionDto(
        String key,
        long sessions,
        long engagedSessions,
        long firstLogSessions,
        long logCreateSessions
) {}
