package com.watchlog.api.dto;

import java.util.List;

public record RecommendationDto(
        List<TitleDto> items,
        String reason
) {}
