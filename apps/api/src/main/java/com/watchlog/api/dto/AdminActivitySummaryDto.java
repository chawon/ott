package com.watchlog.api.dto;

public record AdminActivitySummaryDto(
        AdminActivityWindowDto period,
        AdminActivityWindowDto today,
        AdminActivityWindowDto last7Days,
        AdminActivityWindowDto last30Days
) {}
