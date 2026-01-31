package com.watchlog.api.dto;

import com.watchlog.api.domain.TitleType;

import java.util.List;

public record SyncTitlePayload(
        TitleType type,
        String name,
        Integer year,
        List<String> genres,
        List<String> directors,
        List<String> cast,
        String overview,
        String posterUrl,
        String author,
        String publisher,
        String isbn10,
        String isbn13,
        String pubdate,
        String provider,
        String providerId
) {}
