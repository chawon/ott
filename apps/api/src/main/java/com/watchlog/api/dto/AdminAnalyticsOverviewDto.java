package com.watchlog.api.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record AdminAnalyticsOverviewDto(
        int days,
        OffsetDateTime from,
        OffsetDateTime to,
        long events,
        long dau,
        long wau,
        long mau,
        long funnelAppOpenUsers,
        long funnelLoginUsers,
        long funnelLogCreateUsers,
        List<AdminPlatformSummaryDto> platforms,
        List<AdminDimensionSummaryDto> deviceTypes,
        List<AdminDimensionSummaryDto> osFamilies,
        List<AdminDimensionSummaryDto> browserFamilies,
        List<AdminDimensionSummaryDto> installStates,
        List<AdminDimensionSummaryDto> domains,
        List<AdminEventBreakdownDto> eventBreakdown,
        AdminOldDomainUsageDto oldDomainUsage,
        List<AdminDailyAnalyticsDto> daily
) {}
