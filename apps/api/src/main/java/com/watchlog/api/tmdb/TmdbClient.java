package com.watchlog.api.tmdb;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.watchlog.api.domain.TitleType;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Component
public class TmdbClient {

    private final RestClient rest;
    private final TmdbProperties props;

    public TmdbClient(@Qualifier("tmdbRestClient") RestClient tmdbRestClient, TmdbProperties props) {
        this.rest = tmdbRestClient;
        this.props = props;
    }

    public List<SearchItem> searchMulti(String q) {
        requireToken();

        var uri = UriComponentsBuilder.fromPath("/search/multi")
                .queryParam("query", q)
                .queryParam("include_adult", "false")
                .queryParam("language", props.language())
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

    public Snapshot fetchDetails(TitleType type, String providerId) {
        requireToken();
        long id = Long.parseLong(providerId);

        if (type == TitleType.movie) {
            var uri = UriComponentsBuilder.fromPath("/movie/{id}")
                    .queryParam("language", props.language())
                    .buildAndExpand(id)
                    .toUriString();

            var m = rest.get().uri(uri).retrieve().body(MovieDetails.class);
            if (m == null) throw new IllegalArgumentException("TMDB movie not found: " + providerId);
            var credits = fetchCredits(TitleType.movie, id);

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
                .queryParam("language", props.language())
                .buildAndExpand(id)
                .toUriString();

        var tv = rest.get().uri(uri).retrieve().body(TvDetails.class);
        if (tv == null) throw new IllegalArgumentException("TMDB tv not found: " + providerId);
        var credits = fetchCredits(TitleType.series, id);

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

    private void requireToken() {
        if (props.accessToken() == null || props.accessToken().isBlank()) {
            throw new IllegalStateException("TMDB_ACCESS_TOKEN is missing");
        }
    }

    private Integer yearFrom(String date) {
        if (date == null || date.length() < 4) return null;
        try { return Integer.parseInt(date.substring(0, 4)); } catch (Exception e) { return null; }
    }

    private String posterUrl(String posterPath) {
        if (posterPath == null || posterPath.isBlank()) return null;
        // 이미지 URL은 base_url + size + file_path 조합이 공식 가이드 :contentReference[oaicite:5]{index=5}
        return "https://image.tmdb.org/t/p/" + props.imageSize() + posterPath;
    }

    private Credits fetchCredits(TitleType type, long id) {
        var builder = (type == TitleType.movie)
                ? UriComponentsBuilder.fromPath("/movie/{id}/credits")
                : UriComponentsBuilder.fromPath("/tv/{id}/credits");
        var uri = builder
                .queryParam("language", props.language())
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

        @JsonProperty("poster_path")
        String posterPath;

        @JsonProperty("overview")
        String overview;

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

    private record Credits(List<String> directors, List<String> cast) {}
}
