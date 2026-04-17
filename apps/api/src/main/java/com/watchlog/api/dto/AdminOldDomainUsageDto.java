package com.watchlog.api.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record AdminOldDomainUsageDto(
        String hostname,
        long appOpenEvents,
        long appOpenUsers,
        long knownUsers,
        long userBoundEvents,
        long loginSuccessUsers,
        long logCreateUsers,
        long shareActionUsers,
        OffsetDateTime lastSeenAt,
        OffsetDateTime lastMeaningfulActionAt,
        List<AdminDimensionSummaryDto> installStates,
        List<AdminDimensionSummaryDto> browserFamilies
) {}
