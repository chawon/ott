package com.watchlog.api.dto;

import java.time.LocalDate;

public record AdminDailyAnalyticsDto(
        LocalDate day,
        long events,
        long appOpenUsers,
        long titleSearchUsers,
        long titleSelectUsers,
        long loginUsers,
        long firstLogCreateUsers,
        long logCreateUsers,
        AdminActivityWindowDto activity,
        AdminReachSummaryDto reach
) {}
