package com.watchlog.api.dto;

import com.watchlog.api.domain.FeedbackCategory;

public record CreateFeedbackThreadRequest(
        FeedbackCategory category,
        String subject,
        String body
) {
}
