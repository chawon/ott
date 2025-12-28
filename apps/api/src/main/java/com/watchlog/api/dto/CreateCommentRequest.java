package com.watchlog.api.dto;

import java.util.UUID;

public record CreateCommentRequest(
        String body,
        UUID userId,
        java.util.List<MentionRef> mentions
) {}
