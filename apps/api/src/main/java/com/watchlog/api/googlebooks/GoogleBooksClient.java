package com.watchlog.api.googlebooks;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.watchlog.api.book.BookIsbn;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.dto.TitleSearchItemDto;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.HtmlUtils;

import java.time.LocalDate;
import java.time.Year;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
public class GoogleBooksClient {
    private final RestClient rest;
    private final GoogleBooksProperties properties;

    public GoogleBooksClient(@Qualifier("googleBooksRestClient") RestClient rest, GoogleBooksProperties properties) {
        this.rest = rest;
        this.properties = properties;
    }

    public List<TitleSearchItemDto> search(String query) {
        if (query == null || query.isBlank()) return List.of();
        if (properties.apiKey().isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Book search is not configured");
        }
        String search = query.trim();
        var queryIsbn = BookIsbn.parse(search);
        if (search.matches("[0-9Xx\\s-]+") && queryIsbn.isbn13() != null) {
            search = "isbn:" + queryIsbn.isbn13();
        }
        SearchResponse response;
        try {
            String searchQuery = search;
            response = rest.get().uri(builder -> builder.path("/books/v1/volumes")
                            .queryParam("q", "{query}").queryParam("langRestrict", "en")
                            .queryParam("printType", "books").queryParam("maxResults", 10)
                            .build(searchQuery))
                    // Keep the credential out of request URLs and propagated exceptions.
                    .header("X-Goog-Api-Key", properties.apiKey())
                    .retrieve().body(SearchResponse.class);
        } catch (RestClientResponseException error) {
            int status = error.getStatusCode().value();
            throw new ResponseStatusException(status == 429 || status == 403
                    ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_GATEWAY,
                    "Book search provider is unavailable");
        } catch (RestClientException error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Book search provider is unavailable");
        }
        if (response == null || response.totalItems() == null || response.totalItems() < 0
                || (response.items() == null && response.totalItems() != 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Invalid book search response");
        }
        if (response.items() == null) return List.of();
        return response.items().stream().filter(Objects::nonNull).map(this::toDto)
                .filter(Objects::nonNull).limit(10).toList();
    }

    private TitleSearchItemDto toDto(Volume volume) {
        String id = text(volume.id());
        VolumeInfo info = volume.volumeInfo();
        if (id == null || info == null) return null;
        String name = text(info.title());
        if (name == null) return null;
        String identifiers = info.industryIdentifiers() == null ? "" : info.industryIdentifiers().stream()
                .filter(Objects::nonNull)
                .filter(identifier -> "ISBN_10".equals(identifier.type()) || "ISBN_13".equals(identifier.type()))
                .map(Identifier::identifier).filter(Objects::nonNull).collect(Collectors.joining(" "));
        var isbn = BookIsbn.parse(identifiers);
        String pubdate = publicationDate(info.publishedDate());
        Integer year = pubdate == null ? null : Integer.valueOf(pubdate.substring(0, 4));
        String author = info.authors() == null ? null : text(info.authors().stream()
                .map(GoogleBooksClient::text).filter(Objects::nonNull).collect(Collectors.joining(", ")));
        String thumbnail = info.imageLinks() == null ? null : text(info.imageLinks().thumbnail());
        if (thumbnail == null && info.imageLinks() != null) thumbnail = text(info.imageLinks().smallThumbnail());
        if (thumbnail != null && thumbnail.startsWith("http://")) thumbnail = "https://" + thumbnail.substring(7);
        return new TitleSearchItemDto("GOOGLE_BOOKS", id, TitleType.book, name, year, thumbnail,
                text(info.description()), author, text(info.publisher()), isbn.isbn10(), isbn.isbn13(), pubdate,
                null, "https://books.google.com/books?id=" + URLEncoder.encode(id, StandardCharsets.UTF_8));
    }

    private static String publicationDate(String value) {
        if (value == null) return null;
        try {
            if (value.matches("[0-9]{4}")) {
                Year.parse(value);
                return value;
            }
            if (value.matches("[0-9]{4}-[0-9]{2}")) return YearMonth.parse(value).toString().replace("-", "");
            if (value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) return LocalDate.parse(value).toString().replace("-", "");
        } catch (DateTimeParseException ignored) {
            // Invalid or imprecise dates must not prevent recording a book.
        }
        return null;
    }

    private static String text(String value) {
        if (value == null) return null;
        String result = HtmlUtils.htmlUnescape(value.replaceAll("<[^>]+>", "")).trim();
        return result.isBlank() ? null : result;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SearchResponse(Integer totalItems, List<Volume> items) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Volume(String id, VolumeInfo volumeInfo) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record VolumeInfo(String title, List<String> authors, String publisher, String publishedDate,
                             String description, List<Identifier> industryIdentifiers, ImageLinks imageLinks) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Identifier(String type, String identifier) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ImageLinks(String thumbnail, String smallThumbnail) {}
}
