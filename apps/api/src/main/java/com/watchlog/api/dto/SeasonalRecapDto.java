package com.watchlog.api.dto;

import java.util.List;

public record SeasonalRecapDto(
        String key,
        String startDate,
        String endDate,
        int totalLogs,
        String topType,
        String topPlace,
        String topOccasion,
        double doneRatePct,
        double noteFillPct,
        List<SeasonalRecapPosterDto> posters
) {}
