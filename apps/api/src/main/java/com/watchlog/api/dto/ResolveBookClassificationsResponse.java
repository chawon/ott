package com.watchlog.api.dto;

import java.util.List;

public record ResolveBookClassificationsResponse(
        List<BookClassificationDto> items
) {}
