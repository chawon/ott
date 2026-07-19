package com.watchlog.api.dto;

import java.time.LocalDate;

public record AdminAcquisitionDailyDto(
        LocalDate day,
        long sessions,
        long engagedSessions,
        long firstLogSessions,
        long logCreateSessions
) {}
