package com.watchlog.api.dto;

import com.watchlog.api.domain.FeedbackMessageEntity;
import com.watchlog.api.domain.FeedbackThreadEntity;

import java.time.OffsetDateTime;
import java.util.UUID;

public record FeedbackThreadSummaryDto(
        UUID id,
        UUID userId,
        String category,
        String status,
        String subject,
        int messageCount,
        String lastMessagePreview,
        String lastAuthorRole,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static FeedbackThreadSummaryDto from(
            FeedbackThreadEntity thread,
            int messageCount,
            FeedbackMessageEntity lastMessage
    ) {
        return new FeedbackThreadSummaryDto(
                thread.getId(),
                thread.getUserId(),
                thread.getCategory().name(),
                thread.getStatus().name(),
                thread.getSubject(),
                messageCount,
                preview(lastMessage == null ? null : lastMessage.getBody()),
                lastMessage == null ? null : lastMessage.getAuthorRole().name(),
                thread.getCreatedAt(),
                thread.getUpdatedAt()
        );
    }

    private static String preview(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.trim().replaceAll("\\s+", " ");
        return normalized.length() > 120 ? normalized.substring(0, 117) + "..." : normalized;
    }
}
