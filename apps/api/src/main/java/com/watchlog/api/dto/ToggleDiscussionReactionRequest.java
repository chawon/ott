package com.watchlog.api.dto;

import com.watchlog.api.domain.DiscussionReactionType;

public record ToggleDiscussionReactionRequest(
        DiscussionReactionType type
) {}
