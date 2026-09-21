package com.watchlog.api.dto;

import java.time.OffsetDateTime;
import java.util.List;
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
        List<SeasonalRecapPosterDto> previousWeekPosters,
        String monthlyTopGenre,
        int monthlyTopGenreCount,
        int daysSinceLastLog,
        UUID continueSeriesTitleId,
        String continueSeriesTitle,
        Integer continueSeriesSeasonNumber,
        Integer continueSeriesEpisodeNumber,
        SeasonalRecapDto seasonalRecap
) {}
