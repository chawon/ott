package com.watchlog.api.service;

import com.watchlog.api.book.BookSearchService;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.dto.TitleSearchItemDto;
import com.watchlog.api.kakao.KakaoBookClient;
import com.watchlog.api.llm.RecommendationItem;
import com.watchlog.api.tmdb.TmdbClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Stream;

@Service
public class RecommendationCatalogService {
    private static final ExecutorService EXECUTOR = Executors.newVirtualThreadPerTaskExecutor();
    private final TmdbClient tmdb;
    private final BookSearchService books;
    private final KakaoBookClient kakao;

    public RecommendationCatalogService(TmdbClient tmdb, BookSearchService books, KakaoBookClient kakao) {
        this.tmdb = tmdb;
        this.books = books;
        this.kakao = kakao;
    }

    public List<RecommendationItem> enrich(List<RecommendationItem> items, String language) {
        var futures = items.stream().map(item -> CompletableFuture.supplyAsync(() -> enrichOne(item, language), EXECUTOR)
                .completeOnTimeout(item, 12, TimeUnit.SECONDS).exceptionally(failure -> item)).toList();
        return futures.stream().map(CompletableFuture::join).toList();
    }

    private RecommendationItem enrichOne(RecommendationItem item, String language) {
        if ("book".equals(item.type())) {
            var queries = new LinkedHashSet<String>();
            queries.add(item.name());
            if (item.alternateNames() != null) queries.addAll(item.alternateNames());
            var found = new ArrayList<TitleSearchItemDto>();
            for (String query : queries.stream().filter(Objects::nonNull).limit(3).toList()) {
                for (var candidate : search(query, "book", item.year(), item.author(), language)) {
                    if (!bookMatches(item, candidate)) continue;
                    if (found.stream().noneMatch(previous -> previous.provider().equals(candidate.provider()) && previous.providerId().equals(candidate.providerId()))) found.add(candidate);
                }
                if (!found.isEmpty()) break;
            }
            if (found.isEmpty()) return item;
            // Books retain an explicit edition choice in the UI. Metadata helps exclusion even when several editions exist.
            return withCatalog(item, found.getFirst(), null);
        }
        var match = findVideo(item, language);
        if (match == null && !"en".equals(language)) match = findVideo(item, "en");
        return match == null ? item : withCatalog(item, videoDto(match), videoDto(match));
    }

    public List<TitleSearchItemDto> search(String name, String type, Integer year, String author, String language) {
        if (name == null || name.isBlank() || name.length() > 255 || !Set.of("movie", "series", "book").contains(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid catalog query");
        }
        if ("book".equals(type)) {
            try {
                var found = books.search(name, language);
                if (!found.isEmpty() || "ko".equals(language)) return found;
            } catch (ResponseStatusException failure) {
                // Google Books development credentials are deferred; the existing Kakao catalog remains usable.
                if ("ko".equals(language)) throw failure;
            }
            return kakao.search(name);
        }
        String tmdbType = "series".equals(type) ? "tv" : "movie";
        return tmdb.searchMulti(name, language).stream().filter(candidate -> tmdbType.equals(candidate.mediaTypeValue()))
                .map(this::videoDto).toList();
    }

    private TmdbClient.SearchItem findVideo(RecommendationItem item, String language) {
        String type = "series".equals(item.type()) ? "tv" : "movie";
        var matches = tmdb.searchMulti(item.name(), language).stream()
                .filter(candidate -> type.equals(candidate.mediaTypeValue()) && candidate.idValue() != null)
                .filter(candidate -> RecommendationTitleMatcher.names(item).contains(RecommendationTitleMatcher.normalize(candidate.displayName()))
                        || RecommendationTitleMatcher.names(item).contains(RecommendationTitleMatcher.normalize(candidate.originalNameValue())))
                .toList();
        if (item.year() != null) {
            return matches.stream().filter(candidate -> candidate.displayYear() != null)
                    .filter(candidate -> Math.abs((long) item.year() - candidate.displayYear()) <= 1)
                    .min(Comparator.comparingLong(candidate -> Math.abs((long) item.year() - candidate.displayYear())))
                    .orElse(null);
        }
        return matches.size() == 1 ? matches.getFirst() : null;
    }

    private boolean bookMatches(RecommendationItem item, TitleSearchItemDto candidate) {
        if (!RecommendationTitleMatcher.names(item).contains(RecommendationTitleMatcher.normalize(candidate.name()))) return false;
        return item.author() != null && candidate.author() != null
                && RecommendationTitleMatcher.authorsMatch(item.author(), candidate.author());
    }

    private RecommendationItem withCatalog(RecommendationItem item, TitleSearchItemDto candidate, TitleSearchItemDto selected) {
        var names = new LinkedHashSet<String>();
        names.add(item.name());
        if (item.alternateNames() != null) names.addAll(item.alternateNames());
        names.add(candidate.name());
        String authors = item.author();
        if (candidate.author() != null && (authors == null || !RecommendationTitleMatcher.authorsMatch(authors, candidate.author()))) {
            authors = authors == null ? candidate.author() : authors + " / " + candidate.author();
        }
        return new RecommendationItem(candidate.name(), item.type(), item.reason(), item.genres(), candidate.posterUrl(),
                candidate.provider(), candidate.providerId(), candidate.year(), names.stream().filter(Objects::nonNull).limit(12).toList(),
                authors, candidate.isbn10(), candidate.isbn13(), item.originalName(), selected);
    }

    private TitleSearchItemDto videoDto(TmdbClient.SearchItem candidate) {
        return new TitleSearchItemDto("TMDB", candidate.idValue().toString(), "tv".equals(candidate.mediaTypeValue()) ? TitleType.series : TitleType.movie,
                candidate.displayName(), candidate.displayYear(), candidate.posterPathValue() == null ? null : "https://image.tmdb.org/t/p/w500" + candidate.posterPathValue(),
                candidate.overviewValue(), null, null, null, null, null);
    }
}
