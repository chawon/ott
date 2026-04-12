package com.watchlog.api.llm;

import java.util.List;

public record RecommendationItem(
        String name,
        String type,
        String reason,
        List<String> genres,
        String posterUrl
) {}
