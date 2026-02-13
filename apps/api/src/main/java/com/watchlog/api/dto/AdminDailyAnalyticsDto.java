package com.watchlog.api.dto;

import java.time.LocalDate;

public record AdminDailyAnalyticsDto(
        LocalDate day,
        long events,
        long appOpenUsers,
        long retroAppOpenUsers,
        long retroToggleUsers,
        long loginUsers,
        long logCreateUsers,
        long shareActionUsers
) {}
