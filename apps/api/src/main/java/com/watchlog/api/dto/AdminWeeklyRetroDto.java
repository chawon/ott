package com.watchlog.api.dto;

import java.time.LocalDate;

public record AdminWeeklyRetroDto(
        LocalDate weekStart,
        long appOpenUsers,
        long retroAppOpenUsers,
        long retroToggleUsers,
        long retroToggleOnUsers
) {}
