package com.watchlog.api.dto;

import com.watchlog.api.domain.FeedbackMessageEntity;

import java.time.OffsetDateTime;
import java.util.UUID;

public record FeedbackMessageDto(
        UUID id,
        String authorRole,
        String body,
        OffsetDateTime createdAt
) {
    public static FeedbackMessageDto from(FeedbackMessageEntity entity) {
        return new FeedbackMessageDto(
                entity.getId(),
                entity.getAuthorRole().name(),
                entity.getBody(),
                entity.getCreatedAt()
        );
    }
}
