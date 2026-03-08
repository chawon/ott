package com.watchlog.api.dto;

import com.watchlog.api.domain.FeedbackThreadEntity;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record FeedbackThreadDetailDto(
        UUID id,
        UUID userId,
        String category,
        String status,
        String subject,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<FeedbackMessageDto> messages
) {
    public static FeedbackThreadDetailDto from(FeedbackThreadEntity thread, List<FeedbackMessageDto> messages) {
        return new FeedbackThreadDetailDto(
                thread.getId(),
                thread.getUserId(),
                thread.getCategory().name(),
                thread.getStatus().name(),
                thread.getSubject(),
                thread.getCreatedAt(),
                thread.getUpdatedAt(),
                messages
        );
    }
}
