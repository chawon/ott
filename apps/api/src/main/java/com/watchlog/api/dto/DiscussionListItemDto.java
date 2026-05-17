package com.watchlog.api.dto;

import com.watchlog.api.domain.DiscussionEntity;
import com.watchlog.api.domain.TitleEntity;
import com.watchlog.api.domain.TitleType;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DiscussionListItemDto(
        UUID id,
        UUID titleId,
        String titleName,
        TitleType titleType,
        Integer titleYear,
        String posterUrl,
        int commentCount,
        OffsetDateTime createdAt,
        DiscussionReactionSummaryDto reactionSummary
) {
    public static DiscussionListItemDto from(DiscussionEntity d) {
        return from(d, null, null, DiscussionReactionSummaryDto.empty());
    }

    public static DiscussionListItemDto from(DiscussionEntity d, String preferredPosterUrl) {
        return from(d, preferredPosterUrl, null, DiscussionReactionSummaryDto.empty());
    }

    public static DiscussionListItemDto from(DiscussionEntity d, String preferredPosterUrl, Integer preferredYear) {
        return from(d, preferredPosterUrl, preferredYear, DiscussionReactionSummaryDto.empty());
    }

    public static DiscussionListItemDto from(
            DiscussionEntity d,
            String preferredPosterUrl,
            Integer preferredYear,
            DiscussionReactionSummaryDto reactionSummary
    ) {
        TitleEntity t = d.getTitle();
        String poster = (preferredPosterUrl != null && !preferredPosterUrl.isBlank())
                ? preferredPosterUrl
                : t.getPosterUrl();
        Integer year = preferredYear != null ? preferredYear : t.getYear();
        return new DiscussionListItemDto(
                d.getId(),
                t.getId(),
                t.getName(),
                t.getType(),
                year,
                poster,
                d.getCommentSeq(),
                d.getCreatedAt(),
                reactionSummary == null ? DiscussionReactionSummaryDto.empty() : reactionSummary
        );
    }
}
