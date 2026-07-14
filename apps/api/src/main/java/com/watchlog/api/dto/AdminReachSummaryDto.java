package com.watchlog.api.dto;

public record AdminReachSummaryDto(
        long titleSearchActors,
        long titleSelectActors,
        long loginActors,
        long firstLogCreateActors,
        long logCreateActors
) {}
