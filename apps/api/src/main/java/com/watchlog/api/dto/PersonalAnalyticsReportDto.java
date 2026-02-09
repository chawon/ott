package com.watchlog.api.dto;

import java.time.OffsetDateTime;

public record PersonalAnalyticsReportDto(
        int totalLogs,
        int thisMonthLogs,
        double doneRatePct,
        double ratingFillPct,
        double noteFillPct,
        String topType,
        String topPlace,
        String topOccasion,
        int streakDays,
        int longestStreakDays,
        OffsetDateTime lastLoggedAt
) {}
