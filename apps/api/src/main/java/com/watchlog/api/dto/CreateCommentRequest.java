package com.watchlog.api.dto;

public record CreateCommentRequest(
        String body,
        java.util.List<MentionRef> mentions,
        Boolean syncLog
) {}
