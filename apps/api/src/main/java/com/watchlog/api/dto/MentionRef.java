package com.watchlog.api.dto;

import com.watchlog.api.domain.TitleType;

public record MentionRef(
        String provider,
        String providerId,
        TitleType titleType
) {}
