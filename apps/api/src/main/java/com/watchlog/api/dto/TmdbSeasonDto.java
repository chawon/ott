package com.watchlog.api.dto;

public record TmdbSeasonDto(
        int seasonNumber,
        String name,
        Integer episodeCount,
        String posterUrl,
        Integer year
) {}
