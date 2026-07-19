package com.watchlog.api.dto;

public record AdminAcquisitionSummaryDto(
        long sessions,
        long engagedSessions,
        long firstLogSessions,
        long logCreateSessions
) {}
