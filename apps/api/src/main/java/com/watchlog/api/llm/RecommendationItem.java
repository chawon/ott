package com.watchlog.api.llm;

import com.watchlog.api.dto.TitleSearchItemDto;
import java.util.List;

public record RecommendationItem(
        String name,
        String type,
        String reason,
        List<String> genres,
        String posterUrl,
        String provider,
        String providerId,
        Integer year,
        List<String> alternateNames,
        String author,
        String isbn10,
        String isbn13,
        String originalName,
        TitleSearchItemDto catalogTitle
) {
    public RecommendationItem(String name, String type, String reason, List<String> genres, String posterUrl,
            String provider, String providerId, Integer year, List<String> alternateNames) {
        this(name, type, reason, genres, posterUrl, provider, providerId, year, alternateNames, null, null, null, null, null);
    }
    public RecommendationItem(String name, String type, String reason, List<String> genres, String posterUrl) {
        this(name, type, reason, genres, posterUrl, null, null, null, List.of());
    }
}
