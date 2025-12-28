package com.watchlog.api.dto;

import com.watchlog.api.domain.CommentEntity;

import java.time.OffsetDateTime;
import java.util.UUID;

public record CommentDto(
        UUID id,
        UUID discussionId,
        UUID userId,
        String authorName,
        String body,
        OffsetDateTime createdAt
) {
    public static CommentDto from(CommentEntity e) {
        return new CommentDto(
                e.getId(),
                e.getDiscussion().getId(),
                e.getUserId(),
                e.getAuthorName(),
                e.getBody(),
                e.getCreatedAt()
        );
    }
}
