package com.watchlog.api.web;

import com.watchlog.api.dto.TitleDto;
import com.watchlog.api.dto.TitleSearchItemDto;
import com.watchlog.api.service.TitleService;
import com.watchlog.api.tmdb.TmdbClient;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/titles")
public class TitleController {

    private final TitleService titleService;
    private final TmdbClient tmdbClient;

    public TitleController(TitleService titleService, TmdbClient tmdbClient) {
        this.titleService = titleService;
        this.tmdbClient = tmdbClient;
    }

    @GetMapping("/search")
    public List<TitleSearchItemDto> search(@RequestParam("q") String q) {
        return tmdbClient.searchMulti(q).stream()
                .map(r -> new TitleSearchItemDto(
                        "TMDB",
                        String.valueOf(r.idValue()),
                        "tv".equals(r.mediaTypeValue()) ? com.watchlog.api.domain.TitleType.series : com.watchlog.api.domain.TitleType.movie,
                        r.displayName(),
                        r.displayYear(),
                        (r.posterPathValue() == null) ? null
                                : "https://image.tmdb.org/t/p/w342" + r.posterPathValue(),
                        r.overviewValue()
                ))
                .toList();
    }

    @GetMapping("/{id}")
    public TitleDto get(@PathVariable UUID id) {
        return TitleDto.from(titleService.require(id));
    }
}
