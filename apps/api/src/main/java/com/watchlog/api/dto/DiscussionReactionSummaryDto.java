package com.watchlog.api.dto;

import com.watchlog.api.domain.DiscussionReactionType;

import java.util.Map;

public record DiscussionReactionSummaryDto(
        long done,
        long curious,
        long save
) {
    public static DiscussionReactionSummaryDto empty() {
        return new DiscussionReactionSummaryDto(0, 0, 0);
    }

    public static DiscussionReactionSummaryDto fromCounts(Map<DiscussionReactionType, Long> counts) {
        if (counts == null || counts.isEmpty()) return empty();
        return new DiscussionReactionSummaryDto(
                counts.getOrDefault(DiscussionReactionType.DONE, 0L),
                counts.getOrDefault(DiscussionReactionType.CURIOUS, 0L),
                counts.getOrDefault(DiscussionReactionType.SAVE, 0L)
        );
    }
}
