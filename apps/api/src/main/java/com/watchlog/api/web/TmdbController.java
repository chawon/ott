package com.watchlog.api.web;

import com.watchlog.api.dto.TmdbEpisodeDto;
import com.watchlog.api.dto.TmdbSeasonDto;
import com.watchlog.api.tmdb.TmdbClient;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tmdb")
public class TmdbController {

    private final TmdbClient tmdbClient;

    public TmdbController(TmdbClient tmdbClient) {
        this.tmdbClient = tmdbClient;
    }

    @GetMapping("/tv/{providerId}/seasons")
    public List<TmdbSeasonDto> seasons(
            @PathVariable String providerId,
            @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String language
    ) {
        return tmdbClient.listSeasons(providerId, language).stream()
                .map(s -> new TmdbSeasonDto(
                        s.seasonNumber(),
                        s.name(),
                        s.episodeCount(),
                        s.posterUrl(),
                        s.year()
                ))
                .toList();
    }

    @GetMapping("/tv/{providerId}/seasons/{seasonNumber}")
    public List<TmdbEpisodeDto> episodes(
            @PathVariable String providerId,
            @PathVariable int seasonNumber,
            @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String language
    ) {
        return tmdbClient.listEpisodes(providerId, seasonNumber, language).stream()
                .map(e -> new TmdbEpisodeDto(e.episodeNumber(), e.name()))
                .toList();
    }
}
