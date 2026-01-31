package com.watchlog.api.dto;

import com.watchlog.api.domain.TitleType;

public record TitleSearchItemDto(
        String provider,
        String providerId,
        TitleType type,
        String name,
        Integer year,
        String posterUrl,
        String overview,
        String author,
        String publisher,
        String isbn10,
        String isbn13,
        String pubdate
) {}
