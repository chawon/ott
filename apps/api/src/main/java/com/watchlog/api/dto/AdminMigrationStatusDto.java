package com.watchlog.api.dto;

import java.time.LocalDate;
import java.util.List;

public record AdminMigrationStatusDto(
        long totalActiveUsers,
        long migratedUsers,
        long notMigratedUsers,
        double migrationRate,
        List<DailyCount> recentMigrations
) {
    public record DailyCount(LocalDate date, long count) {}
}
