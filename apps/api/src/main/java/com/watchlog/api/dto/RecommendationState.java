package com.watchlog.api.dto;

import com.watchlog.api.llm.RecommendationItem;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record RecommendationState(
        List<RecommendationItem> items,
        List<Map<String, Object>> exclusions,
        Quota quota,
        OffsetDateTime generatedAt,
        UUID generationId,
        boolean generating,
        boolean hasBatch,
        boolean eligible
) {
    public record Quota(String date, String timezone, int limit, int used, int remaining, OffsetDateTime resetsAt) {}
}
