package com.watchlog.api.kakao;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.watchlog.api.book.BookIsbn;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.dto.TitleSearchItemDto;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Component
public class KakaoBookClient {
    private final RestClient rest;
    private final KakaoProperties properties;

    public KakaoBookClient(@Qualifier("kakaoRestClient") RestClient rest, KakaoProperties properties) {
        this.rest = rest;
        this.properties = properties;
    }

    public List<TitleSearchItemDto> search(String query) {
        if (query == null || query.isBlank()) return List.of();
        if (properties.restApiKey().isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Book search is not configured");
        }
        SearchResponse response;
        try {
            response = rest.get().uri(builder -> builder.path("/v3/search/book")
                            .queryParam("query", "{query}").queryParam("size", 10).queryParam("page", 1)
                            .build(query.trim()))
                    .header(HttpHeaders.AUTHORIZATION, "KakaoAK " + properties.restApiKey())
                    .retrieve().body(SearchResponse.class);
        } catch (RestClientResponseException error) {
            var status = error.getStatusCode().value() == 429
                    ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_GATEWAY;
            // Do not attach the upstream exception: it can contain request/query or response details.
            throw new ResponseStatusException(status, "Book search provider is unavailable");
        } catch (RestClientException error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Book search provider is unavailable");
        }
        if (response == null || response.documents() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Invalid book search response");
        }
        return response.documents().stream().filter(Objects::nonNull).map(this::toDto)
                .filter(Objects::nonNull).limit(10).toList();
    }

    private TitleSearchItemDto toDto(Document document) {
        String name = text(document.title());
        if (name == null) return null;
        var isbn = BookIsbn.parse(document.isbn());
        String providerId = isbn.isbn13();
        if (providerId == null) {
            String url = text(document.url());
            if (url == null) return null;
            providerId = hash(url);
        }
        String pubdate = null;
        Integer year = null;
        try {
            var date = OffsetDateTime.parse(document.datetime()).toLocalDate();
            pubdate = date.format(DateTimeFormatter.BASIC_ISO_DATE);
            year = date.getYear();
        } catch (DateTimeParseException | NullPointerException ignored) {
            // Missing publication dates must not prevent saving a book.
        }
        String author = document.authors() == null ? null : text(document.authors().stream()
                .map(KakaoBookClient::text).filter(Objects::nonNull).collect(Collectors.joining(", ")));
        return new TitleSearchItemDto("KAKAO", providerId, TitleType.book, name, year,
                text(document.thumbnail()), text(document.contents()), author, text(document.publisher()),
                isbn.isbn10(), isbn.isbn13(), pubdate);
    }

    private static String text(String value) {
        if (value == null) return null;
        String result = org.springframework.web.util.HtmlUtils.htmlUnescape(value.replaceAll("<[^>]+>", "")).trim();
        return result.isBlank() ? null : result;
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8))).substring(0, 40);
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SearchResponse(List<Document> documents) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Document(String title, String contents, String url, String isbn, String datetime,
                           List<String> authors, String publisher, String thumbnail) {}
}
