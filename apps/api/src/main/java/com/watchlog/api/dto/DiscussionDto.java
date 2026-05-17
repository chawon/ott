package com.watchlog.api.dto;

import com.watchlog.api.domain.DiscussionEntity;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DiscussionDto(
        UUID id,
        UUID titleId,
        int commentSeq,
        OffsetDateTime createdAt,
        DiscussionReactionSummaryDto reactionSummary
) {
    public static DiscussionDto from(DiscussionEntity e) {
        return from(e, DiscussionReactionSummaryDto.empty());
    }

    public static DiscussionDto from(DiscussionEntity e, DiscussionReactionSummaryDto reactionSummary) {
        return new DiscussionDto(
                e.getId(),
                e.getTitle().getId(),
                e.getCommentSeq(),
                e.getCreatedAt(),
                reactionSummary == null ? DiscussionReactionSummaryDto.empty() : reactionSummary
        );
    }
}
