package com.watchlog.api.tmdb;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.watchlog.api.domain.TitleType;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class TmdbClient {

    private final RestClient rest;
    private final TmdbProperties props;
    private final ConcurrentHashMap<String, FallbackCacheEntry> fallbackCache =
            new ConcurrentHashMap<>();
    private static final int KOREAN_TRENDING_PAGES = 5;

    public TmdbClient(@Qualifier("tmdbRestClient") RestClient tmdbRestClient, TmdbProperties props) {
        this.rest = tmdbRestClient;
        this.props = props;
    }

    public List<SearchItem> searchMulti(String q, String language) {
        requireToken();

        var uri = UriComponentsBuilder.fromPath("/search/multi")
                .queryParam("query", q)
                .queryParam("include_adult", "false")
                .queryParam("language", language != null ? language : props.language())
                .queryParam("page", 1)
                .build()
                .toUriString();

        var res = rest.get().uri(uri).retrieve().body(SearchResponse.class);
        if (res == null || res.results == null) return List.of();

        return res.results.stream()
                .filter(r -> "movie".equals(r.mediaType) || "tv".equals(r.mediaType))
                .filter(r -> r.id != null)
                .limit(10)
                .toList();
    }

    public List<SearchItem> availablePopular(String language, int limit) {
        requireToken();
        int safeLimit = Math.max(1, Math.min(limit, 40));
        var locale = resolveLocale(language);
        String today = LocalDate.now().toString();
        String mode = locale.koreanFallback() ? "trending-ko" : "available";
        String cacheKey = mode + ":" + locale.language() + ":" + locale.region() + ":" + today;
        var now = Instant.now();
        var cached = fallbackCache.get(cacheKey);
        if (cached != null && cached.expiresAt().isAfter(now)) {
            return cached.items().stream().limit(safeLimit).toList();
        }

        var items = locale.koreanFallback()
                ? fetchMixedKoreanTrending(locale.language(), today, safeLimit)
                : fetchMixedAvailablePopular(locale, today);
        fallbackCache.put(
                cacheKey,
                new FallbackCacheEntry(now.plus(Duration.ofDays(1)), items)
        );
        return items.stream().limit(safeLimit).toList();
    }

    public Snapshot fetchDetails(TitleType type, String providerId, String language) {
        requireToken();
        long id = Long.parseLong(providerId);
        String lang = language != null ? language : props.language();

        if (type == TitleType.movie) {
            var uri = UriComponentsBuilder.fromPath("/movie/{id}")
                    .queryParam("language", lang)
                    .buildAndExpand(id)
                    .toUriString();

            var m = rest.get().uri(uri).retrieve().body(MovieDetails.class);
            if (m == null) throw new IllegalArgumentException("TMDB movie not found: " + providerId);
            var credits = fetchCredits(TitleType.movie, id, lang);

            return new Snapshot(
                    TitleType.movie,
                    m.title,
                    yearFrom(m.releaseDate),
                    m.overview,
                    posterUrl(m.posterPath),
                    (m.genres == null) ? List.of() : m.genres.stream().map(g -> g.name).filter(Objects::nonNull).toList(),
                    credits.directors(),
                    credits.cast()
            );
        }

        var uri = UriComponentsBuilder.fromPath("/tv/{id}")
                .queryParam("language", lang)
                .buildAndExpand(id)
                .toUriString();

        var tv = rest.get().uri(uri).retrieve().body(TvDetails.class);
        if (tv == null) throw new IllegalArgumentException("TMDB tv not found: " + providerId);
        var credits = fetchCredits(TitleType.series, id, lang);

        return new Snapshot(
                TitleType.series,
                tv.name,
                yearFrom(tv.firstAirDate),
                tv.overview,
                posterUrl(tv.posterPath),
                (tv.genres == null) ? List.of() : tv.genres.stream().map(g -> g.name).filter(Objects::nonNull).toList(),
                credits.directors(),
                credits.cast()
        );
    }

    public List<SeasonItem> listSeasons(String providerId, String language) {
        requireToken();
        long id = Long.parseLong(providerId);

        var uri = UriComponentsBuilder.fromPath("/tv/{id}")
                .queryParam("language", language != null ? language : props.language())
                .buildAndExpand(id)
                .toUriString();

        var tv = rest.get().uri(uri).retrieve().body(TvDetails.class);
        if (tv == null || tv.seasons == null) return List.of();

        return tv.seasons.stream()
                .filter(s -> s.seasonNumber != null)
                .sorted(Comparator.comparingInt(s -> s.seasonNumber))
                .map(s -> new SeasonItem(
                        s.seasonNumber,
                        s.name,
                        s.episodeCount,
                        posterUrl(s.posterPath),
                        yearFrom(s.airDate)
                ))
                .toList();
    }

    public List<EpisodeItem> listEpisodes(String providerId, int seasonNumber, String language) {
        requireToken();
        long id = Long.parseLong(providerId);

        var uri = UriComponentsBuilder.fromPath("/tv/{id}/season/{season}")
                .queryParam("language", language != null ? language : props.language())
                .buildAndExpand(id, seasonNumber)
                .toUriString();

        var season = rest.get().uri(uri).retrieve().body(SeasonDetails.class);
        if (season == null || season.episodes == null) return List.of();

        return season.episodes.stream()
                .filter(e -> e.episodeNumber != null)
                .sorted(Comparator.comparingInt(e -> e.episodeNumber))
                .map(e -> new EpisodeItem(e.episodeNumber, e.name))
                .toList();
    }

    public String findPosterUrl(String name, String type, String language) {
        if (props.accessToken() == null || props.accessToken().isBlank()) return null;
        try {
            String tmdbMediaType = "series".equals(type) ? "tv" : type;
            var results = searchMulti(name, language);
            return results.stream()
                    .filter(r -> tmdbMediaType.equals(r.mediaType))
                    .filter(r -> r.posterPath != null && !r.posterPath.isBlank())
                    .findFirst()
                    .map(r -> posterUrl(r.posterPath))
                    .orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    private void requireToken() {
        if (props.accessToken() == null || props.accessToken().isBlank()) {
            throw new IllegalStateException("TMDB_ACCESS_TOKEN is missing");
        }
    }

    private List<SearchItem> fetchMixedAvailablePopular(LocalePreference locale, String today) {
        var movies = fetchAvailablePopular("movie", locale, today);
        var tvShows = fetchAvailablePopular("tv", locale, today);
        var mixed = new ArrayList<SearchItem>();
        int max = Math.max(movies.size(), tvShows.size());
        for (int i = 0; i < max; i++) {
            if (i < movies.size()) mixed.add(movies.get(i));
            if (i < tvShows.size()) mixed.add(tvShows.get(i));
        }
        return mixed;
    }

    private List<SearchItem> fetchMixedKoreanTrending(
            String language,
            String today,
            int limit
    ) {
        int perTypeLimit = Math.max(6, limit);
        var movies = fetchKoreanTrending("movie", language, today, perTypeLimit);
        var tvShows = fetchKoreanTrending("tv", language, today, perTypeLimit);
        var mixed = new ArrayList<SearchItem>();
        int max = Math.max(movies.size(), tvShows.size());
        for (int i = 0; i < max; i++) {
            if (i < movies.size()) mixed.add(movies.get(i));
            if (i < tvShows.size()) mixed.add(tvShows.get(i));
        }
        return mixed;
    }

    private List<SearchItem> fetchKoreanTrending(
            String mediaType,
            String language,
            String today,
            int limit
    ) {
        var items = new ArrayList<SearchItem>();
        for (int page = 1; page <= KOREAN_TRENDING_PAGES && items.size() < limit; page++) {
            var uri = UriComponentsBuilder.fromPath("/trending/{mediaType}/week")
                    .queryParam("language", language)
                    .queryParam("page", page)
                    .buildAndExpand(mediaType)
                    .toUriString();

            var res = rest.get().uri(uri).retrieve().body(SearchResponse.class);
            if (res == null || res.results == null || res.results.isEmpty()) break;

            var pageItems = res.results.stream()
                    .filter(r -> r.id != null)
                    .filter(r -> !Boolean.TRUE.equals(r.adult))
                    .peek(r -> {
                        if (r.mediaType == null || r.mediaType.isBlank()) {
                            r.mediaType = mediaType;
                        }
                    })
                    .filter(r -> "movie".equals(r.mediaType) || "tv".equals(r.mediaType))
                    .filter(this::isKoreanContent)
                    .filter(r -> isReleased(r, today))
                    .filter(r -> r.displayName() != null && !r.displayName().isBlank())
                    .toList();
            items.addAll(pageItems);
        }
        return items.stream().limit(limit).toList();
    }

    private List<SearchItem> fetchAvailablePopular(
            String mediaType,
            LocalePreference locale,
            String today
    ) {
        var builder = UriComponentsBuilder.fromPath("/discover/{mediaType}")
                .queryParam("include_adult", "false")
                .queryParam("language", locale.language())
                .queryParam("page", 1)
                .queryParam("sort_by", "popularity.desc")
                .queryParam("watch_region", locale.region())
                .queryParam("with_watch_monetization_types", "flatrate|free|ads|rent|buy");

        if ("movie".equals(mediaType)) {
            builder
                    .queryParam("include_video", "false")
                    .queryParam("release_date.lte", today);
        } else {
            builder
                    .queryParam("first_air_date.lte", today)
                    .queryParam("include_null_first_air_dates", "false");
        }

        var uri = builder.buildAndExpand(mediaType).toUriString();

        var res = rest.get().uri(uri).retrieve().body(SearchResponse.class);
        if (res == null || res.results == null) return List.of();

        return res.results.stream()
                .filter(r -> r.id != null)
                .filter(r -> !Boolean.TRUE.equals(r.adult))
                .peek(r -> {
                    if (r.mediaType == null || r.mediaType.isBlank()) {
                        r.mediaType = mediaType;
                    }
                })
                .filter(r -> "movie".equals(r.mediaType) || "tv".equals(r.mediaType))
                .filter(r -> r.displayName() != null && !r.displayName().isBlank())
                .toList();
    }

    private boolean isKoreanContent(SearchItem item) {
        if ("ko".equalsIgnoreCase(item.originalLanguage)) return true;
        return item.originCountries != null &&
                item.originCountries.stream().anyMatch("KR"::equalsIgnoreCase);
    }

    private boolean isReleased(SearchItem item, String today) {
        String date = "tv".equals(item.mediaType) ? item.firstAirDate : item.releaseDate;
        if (date == null || date.length() < 10) return false;
        return date.substring(0, 10).compareTo(today) <= 0;
    }

    private LocalePreference resolveLocale(String language) {
        String lang = (language == null || language.isBlank())
                ? props.language()
                : language;
        String primary = lang.split(",", 2)[0]
                .split(";", 2)[0]
                .trim()
                .replace('_', '-');
        if (primary.isBlank()) primary = props.language();

        String[] parts = primary.split("-", 3);
        String languageCode = parts[0].toLowerCase(Locale.ROOT);
        String region = parts.length >= 2 && !parts[1].isBlank()
                ? parts[1].toUpperCase(Locale.ROOT)
                : defaultRegion(languageCode);
        return new LocalePreference(
                languageCode + "-" + region,
                region,
                "ko".equals(languageCode) && "KR".equals(region)
        );
    }

    private String defaultRegion(String languageCode) {
        if ("ko".equals(languageCode)) return "KR";
        if ("en".equals(languageCode)) return "US";

        String configured = props.language();
        if (configured != null && configured.contains("-")) {
            return configured.substring(configured.indexOf('-') + 1).toUpperCase(Locale.ROOT);
        }
        return "US";
    }

    private Integer yearFrom(String date) {
        if (date == null || date.length() < 4) return null;
        try { return Integer.parseInt(date.substring(0, 4)); } catch (Exception e) { return null; }
    }

    private String posterUrl(String posterPath) {
        if (posterPath == null || posterPath.isBlank()) return null;
        // 이미지 URL은 base_url + size + file_path 조합이 공식 가이드 :contentReference[oaicite:20]{index=20}
        return "https://image.tmdb.org/t/p/" + props.imageSize() + posterPath;
    }

    private Credits fetchCredits(TitleType type, long id, String language) {
        var builder = (type == TitleType.movie)
                ? UriComponentsBuilder.fromPath("/movie/{id}/credits")
                : UriComponentsBuilder.fromPath("/tv/{id}/credits");
        var uri = builder
                .queryParam("language", language)
                .buildAndExpand(id)
                .toUriString();

        var res = rest.get().uri(uri).retrieve().body(CreditsResponse.class);
        if (res == null) return new Credits(List.of(), List.of());

        var directors = (res.crew == null) ? List.<String>of() : res.crew.stream()
                .filter(c -> c.job != null && c.name != null && "Director".equalsIgnoreCase(c.job))
                .map(c -> c.name)
                .distinct()
                .limit(3)
                .toList();

        var castNames = (res.cast == null) ? List.<String>of() : res.cast.stream()
                .sorted(Comparator.comparingInt(c -> c.order == null ? 9999 : c.order))
                .map(c -> c.name)
                .filter(Objects::nonNull)
                .distinct()
                .limit(5)
                .toList();

        return new Credits(directors, castNames);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class SearchResponse {
        @JsonProperty("results")
        List<SearchItem> results;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SearchItem {
        @JsonProperty("id")
        Long id;

        @JsonProperty("media_type")
        String mediaType;

        @JsonProperty("title")
        String title;

        @JsonProperty("name")
        String name;

        @JsonProperty("release_date")
        String releaseDate;

        @JsonProperty("first_air_date")
        String firstAirDate;

        @JsonProperty("original_language")
        String originalLanguage;

        @JsonProperty("origin_country")
        List<String> originCountries;

        @JsonProperty("poster_path")
        String posterPath;

        @JsonProperty("overview")
        String overview;

        @JsonProperty("adult")
        Boolean adult;

        public String displayName() {
            return (title != null && !title.isBlank()) ? title : name;
        }

        public Integer displayYear() {
            String d = (releaseDate != null && !releaseDate.isBlank()) ? releaseDate : firstAirDate;
            if (d == null || d.length() < 4) return null;
            try { return Integer.parseInt(d.substring(0, 4)); } catch (Exception e) { return null; }
        }
        public Long idValue() { return id; }
        public String mediaTypeValue() { return mediaType; }
        public String overviewValue() { return overview; }
        public String posterPathValue() { return posterPath; }

    }

    private record LocalePreference(
            String language,
            String region,
            boolean koreanFallback
    ) {}

    private record FallbackCacheEntry(Instant expiresAt, List<SearchItem> items) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Genre {
        @JsonProperty("name") String name;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class MovieDetails {
        @JsonProperty("title") String title;
        @JsonProperty("release_date") String releaseDate;
        @JsonProperty("overview") String overview;
        @JsonProperty("poster_path") String posterPath;
        @JsonProperty("genres") List<Genre> genres;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class TvDetails {
        @JsonProperty("name") String name;
        @JsonProperty("first_air_date") String firstAirDate;
        @JsonProperty("overview") String overview;
        @JsonProperty("poster_path") String posterPath;
        @JsonProperty("genres") List<Genre> genres;
        @JsonProperty("seasons") List<SeasonSummary> seasons;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class SeasonSummary {
        @JsonProperty("season_number") Integer seasonNumber;
        @JsonProperty("name") String name;
        @JsonProperty("poster_path") String posterPath;
        @JsonProperty("episode_count") Integer episodeCount;
        @JsonProperty("air_date") String airDate;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class SeasonDetails {
        @JsonProperty("episodes") List<EpisodeSummary> episodes;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class EpisodeSummary {
        @JsonProperty("episode_number") Integer episodeNumber;
        @JsonProperty("name") String name;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class CreditsResponse {
        @JsonProperty("cast") List<CastMember> cast;
        @JsonProperty("crew") List<CrewMember> crew;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class CastMember {
        @JsonProperty("name") String name;
        @JsonProperty("order") Integer order;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class CrewMember {
        @JsonProperty("name") String name;
        @JsonProperty("job") String job;
    }

    public record Snapshot(
            TitleType type,
            String name,
            Integer year,
            String overview,
            String posterUrl,
            List<String> genres,
            List<String> directors,
            List<String> cast
    ) {}

    public record SeasonItem(
            int seasonNumber,
            String name,
            Integer episodeCount,
            String posterUrl,
            Integer year
    ) {}

    public record EpisodeItem(
            int episodeNumber,
            String name
    ) {}

    private record Credits(List<String> directors, List<String> cast) {}
}
