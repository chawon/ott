package com.watchlog.api.tmdb;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "tmdb")
public record TmdbProperties(
        String baseUrl,
        String accessToken,
        String language,
        String imageSize
) {
    public TmdbProperties {
        if (baseUrl == null || baseUrl.isBlank()) baseUrl = "https://api.themoviedb.org/3";
        if (language == null || language.isBlank()) language = "ko-KR";
        if (imageSize == null || imageSize.isBlank()) imageSize = "w342";
    }
}
