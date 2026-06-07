package com.watchlog.api.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

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
        OffsetDateTime lastLoggedAt,
        int previousWeekLogs,
        String monthlyTopGenre,
        int monthlyTopGenreCount,
        int daysSinceLastLog,
        UUID continueSeriesTitleId,
        String continueSeriesTitle,
        Integer continueSeriesSeasonNumber,
        Integer continueSeriesEpisodeNumber
) {}
