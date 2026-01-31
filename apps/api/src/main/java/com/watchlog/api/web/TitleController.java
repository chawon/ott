package com.watchlog.api.web;

import com.watchlog.api.dto.TitleDto;
import com.watchlog.api.dto.TitleSearchItemDto;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.naver.NaverBookClient;
import com.watchlog.api.service.TitleService;
import com.watchlog.api.tmdb.TmdbClient;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/titles")
public class TitleController {

    private final TitleService titleService;
    private final TmdbClient tmdbClient;
    private final NaverBookClient naverBookClient;

    public TitleController(TitleService titleService, TmdbClient tmdbClient, NaverBookClient naverBookClient) {
        this.titleService = titleService;
        this.tmdbClient = tmdbClient;
        this.naverBookClient = naverBookClient;
    }

    @GetMapping("/search")
    public List<TitleSearchItemDto> search(
            @RequestParam("q") String q,
            @RequestParam(value = "type", required = false) String type
    ) {
        String normalized = type == null ? null : type.trim().toLowerCase();
        if (normalized == null || normalized.isBlank()) {
            return tmdbClient.searchMulti(q).stream()
                    .map(r -> new TitleSearchItemDto(
                            "TMDB",
                            String.valueOf(r.idValue()),
                            "tv".equals(r.mediaTypeValue()) ? com.watchlog.api.domain.TitleType.series : com.watchlog.api.domain.TitleType.movie,
                            r.displayName(),
                            r.displayYear(),
                            (r.posterPathValue() == null) ? null
                                    : "https://image.tmdb.org/t/p/w342" + r.posterPathValue(),
                            r.overviewValue(),
                            null,
                            null,
                            null,
                            null,
                            null
                    ))
                    .toList();
        }

        if ("book".equals(normalized)) {
            return naverBookClient.search(q).stream()
                    .map(item -> {
                        var isbn = NaverBookClient.parseIsbn(item.isbnValue());
                        var providerId = NaverBookClient.providerIdFrom(isbn, item.linkValue());
                        return new TitleSearchItemDto(
                                "NAVER",
                                providerId,
                                TitleType.book,
                                item.titleValue(),
                                yearFromPubdate(item.pubdateValue()),
                                item.imageValue(),
                                item.descriptionValue(),
                                item.authorValue(),
                                item.publisherValue(),
                                isbn.isbn10(),
                                isbn.isbn13(),
                                item.pubdateValue()
                        );
                    })
                    .toList();
        }

        if ("movie".equals(normalized) || "series".equals(normalized)) {
            return tmdbClient.searchMulti(q).stream()
                    .filter(r -> normalized.equals("movie") ? "movie".equals(r.mediaTypeValue()) : "tv".equals(r.mediaTypeValue()))
                    .map(r -> new TitleSearchItemDto(
                            "TMDB",
                            String.valueOf(r.idValue()),
                            "tv".equals(r.mediaTypeValue()) ? com.watchlog.api.domain.TitleType.series : com.watchlog.api.domain.TitleType.movie,
                            r.displayName(),
                            r.displayYear(),
                            (r.posterPathValue() == null) ? null
                                    : "https://image.tmdb.org/t/p/w342" + r.posterPathValue(),
                            r.overviewValue(),
                            null,
                            null,
                            null,
                            null,
                            null
                    ))
                    .toList();
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported type: " + type);
    }

    @GetMapping("/{id}")
    public TitleDto get(@PathVariable UUID id) {
        return TitleDto.from(titleService.require(id));
    }

    private Integer yearFromPubdate(String pubdate) {
        if (pubdate == null || pubdate.length() < 4) return null;
        try {
            return Integer.parseInt(pubdate.substring(0, 4));
        } catch (Exception e) {
            return null;
        }
    }
}
