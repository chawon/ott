package com.watchlog.api.dto;

import com.watchlog.api.domain.TitleType;

public record TitleSearchItemDto(
        String provider,
        String providerId,
        TitleType type,
        String name,
        Integer year,
        String posterUrl,
        String overview
) {}
