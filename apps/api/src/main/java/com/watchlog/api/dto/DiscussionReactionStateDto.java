package com.watchlog.api.dto;

import com.watchlog.api.domain.DiscussionReactionType;

import java.util.Set;

public record DiscussionReactionStateDto(
        DiscussionReactionSummaryDto summary,
        Set<DiscussionReactionType> selectedTypes,
        boolean selected
) {}
