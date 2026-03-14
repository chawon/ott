package com.watchlog.api.web;

import com.watchlog.api.dto.TitleDto;
import com.watchlog.api.dto.TitleSearchItemDto;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.naver.NaverBookClient;
import com.watchlog.api.service.TitleService;
import com.watchlog.api.tmdb.TmdbClient;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/titles")
public class TitleController {

    private final TitleService titleService;
    private final TmdbClient tmdbClient;
    private final NaverBookClient naverBookClient;

    public TitleController(
            TitleService titleService,
            TmdbClient tmdbClient,
            NaverBookClient naverBookClient
    ) {
        this.titleService = titleService;
        this.tmdbClient = tmdbClient;
        this.naverBookClient = naverBookClient;
    }

    @GetMapping("/search")
    public List<TitleSearchItemDto> search(
            @RequestParam("q") String q,
            @RequestParam(value = "type", required = false) String type,
            @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String language
    ) {
        String normalized = type == null ? null : type.trim().toLowerCase();

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
                    .collect(Collectors.toList());
        }

        return tmdbClient.searchMulti(q, language).stream()
                .filter(item -> {
                    String mType = item.mediaTypeValue();
                    if (normalized != null && !normalized.isBlank()) {
                        return normalized.equals(mType);
                    }
                    return "movie".equals(mType) || "tv".equals(mType);
                })
                .map(item -> {
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
                })
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

    private Integer yearFromDate(String date) {
        if (date == null || date.length() < 4) return null;
        try {
            return Integer.parseInt(date.substring(0, 4));
        } catch (Exception e) {
            return null;
        }
    }

    private Integer yearFromPubdate(String pubdate) {
        return yearFromDate(pubdate);
    }
}
