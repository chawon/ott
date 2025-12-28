package com.watchlog.api.dto;

import com.watchlog.api.domain.DiscussionEntity;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DiscussionDto(
        UUID id,
        UUID titleId,
        int commentSeq,
        OffsetDateTime createdAt
) {
    public static DiscussionDto from(DiscussionEntity e) {
        return new DiscussionDto(
                e.getId(),
                e.getTitle().getId(),
                e.getCommentSeq(),
                e.getCreatedAt()
        );
    }
}
