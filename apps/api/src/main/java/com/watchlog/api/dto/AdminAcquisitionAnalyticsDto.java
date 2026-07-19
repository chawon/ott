package com.watchlog.api.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record AdminAcquisitionAnalyticsDto(
        int days,
        OffsetDateTime from,
        OffsetDateTime to,
        AdminAcquisitionSummaryDto summary,
        List<AdminAcquisitionDimensionDto> byChannel,
        List<AdminAcquisitionDimensionDto> bySource,
        List<AdminAcquisitionDimensionDto> byLandingPath,
        List<AdminAcquisitionDimensionDto> byLocale,
        List<AdminAcquisitionDimensionDto> byCampaign,
        List<AdminAcquisitionDailyDto> daily,
        long orphanConversionSessions
) {}
