package com.watchlog.api.dto;

import java.util.List;

public record ResolveBookClassificationsRequest(
        List<String> isbn13s
) {}
