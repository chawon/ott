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
        long retroAppOpenUsers,
        long retroToggleUsers,
        List<AdminPlatformSummaryDto> platforms,
        List<AdminEventBreakdownDto> eventBreakdown,
        List<AdminDailyAnalyticsDto> daily,
        List<AdminWeeklyRetroDto> weeklyRetro
) {}
