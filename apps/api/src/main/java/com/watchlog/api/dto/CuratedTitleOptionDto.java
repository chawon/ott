package com.watchlog.api.dto;

import com.watchlog.api.domain.TitleType;

import java.util.UUID;

public record CuratedTitleOptionDto(
        UUID id,
        String name,
        TitleType type,
        Integer year,
        String posterUrl
) {}
