package com.watchlog.api.dto;

import java.util.List;

public record DailyReportDto(
        String date,
        CloudflareStatsDto cloudflare,
        Ga4StatsDto ga4,
        InternalStatsDto internal,
        K8sStatusDto kubernetes
) {

    public record CloudflareStatsDto(
            long requests,
            long uniqueVisitors,
            long pageViews,
            String error
    ) {}

    public record Ga4StatsDto(
            long sessions,
            long activeUsers,
            long pageViews,
            long newUsers,
            String error
    ) {}

    public record InternalStatsDto(
            long dau,
            long logCreate,
            long dbLogCreateCount,
            long newDevices
    ) {}

    public record K8sStatusDto(
            List<PodStatusDto> pods,
            String error
    ) {}

    public record PodStatusDto(
            String name,
            String phase,
            String imageTag,
            String cpuUsage,
            String memoryUsage
    ) {}
}
