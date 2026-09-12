package com.watchlog.api.web;

import com.watchlog.api.dto.TitleDto;
import com.watchlog.api.dto.TitleSearchItemDto;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.book.BookSearchService;
import com.watchlog.api.service.TitleService;
import com.watchlog.api.tmdb.TmdbClient;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/titles")
public class TitleController {

    private final TitleService titleService;
    private final TmdbClient tmdbClient;
    private final BookSearchService bookSearchService;

    public TitleController(
            TitleService titleService,
            TmdbClient tmdbClient,
            BookSearchService bookSearchService
    ) {
        this.titleService = titleService;
        this.tmdbClient = tmdbClient;
        this.bookSearchService = bookSearchService;
    }

    @GetMapping("/search")
    public List<TitleSearchItemDto> search(
            @RequestParam("q") String q,
            @RequestParam(value = "type", required = false) String type,
            @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String language
    ) {
        String normalized = type == null ? null : type.trim().toLowerCase();

        if ("book".equals(normalized)) {
            return bookSearchService.search(q);
        }

        return tmdbClient.searchMulti(q, language).stream()
                .filter(item -> {
                    String mType = item.mediaTypeValue();
                    if (normalized != null && !normalized.isBlank()) {
                        return normalized.equals(mType);
                    }
                    return "movie".equals(mType) || "tv".equals(mType);
                })
                .map(this::fromTmdbItem)
                .collect(Collectors.toList());
    }

    @GetMapping("/popular")
    public List<TitleSearchItemDto> popular(
            @RequestParam(value = "limit", defaultValue = "6") int limit,
            @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String language
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 20));
        return tmdbClient.availablePopular(language, safeLimit).stream()
                .map(this::fromTmdbItem)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public TitleDto get(@PathVariable UUID id) {
        return TitleDto.from(titleService.require(id));
    }

    private String tmdbPosterUrl(String path) {
        if (path == null || path.isBlank()) return null;
        return "https://image.tmdb.org/t/p/w342" + path;
    }

    private TitleSearchItemDto fromTmdbItem(TmdbClient.SearchItem item) {
        String mType = item.mediaTypeValue();
        boolean isTv = "tv".equals(mType);
        return new TitleSearchItemDto(
                "TMDB",
                String.valueOf(item.idValue()),
                isTv ? TitleType.series : TitleType.movie,
                item.displayName(),
                item.displayYear(),
                tmdbPosterUrl(item.posterPathValue()),
                item.overviewValue(),
                null,
                null,
                null,
                null,
                null
        );
    }

}
