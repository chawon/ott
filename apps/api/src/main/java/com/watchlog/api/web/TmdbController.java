package com.watchlog.api.web;

import com.watchlog.api.dto.TmdbEpisodeDto;
import com.watchlog.api.dto.TmdbSeasonDto;
import com.watchlog.api.tmdb.TmdbClient;
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
    public List<TmdbSeasonDto> seasons(@PathVariable String providerId) {
        return tmdbClient.listSeasons(providerId).stream()
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
    public List<TmdbEpisodeDto> episodes(@PathVariable String providerId, @PathVariable int seasonNumber) {
        return tmdbClient.listEpisodes(providerId, seasonNumber).stream()
                .map(e -> new TmdbEpisodeDto(e.episodeNumber(), e.name()))
                .toList();
    }
}
