package com.watchlog.api.naver;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

@Component
public class NaverBookClient {

    private final RestClient rest;
    private final NaverProperties props;

    public NaverBookClient(@Qualifier("naverRestClient") RestClient rest, NaverProperties props) {
        this.rest = rest;
        this.props = props;
    }

    public List<SearchItem> search(String q) {
        requireCredentials();
        if (q == null || q.trim().isEmpty()) return List.of();

        var uri = UriComponentsBuilder.fromPath("/v1/search/book.json")
                .queryParam("query", q.trim())
                .queryParam("display", 10)
                .queryParam("start", 1)
                .build()
                .toUriString();

        var res = rest.get().uri(uri).retrieve().body(SearchResponse.class);
        if (res == null || res.items == null) return List.of();
        return res.items.stream()
                .filter(i -> i.title != null && !i.title.isBlank())
                .limit(10)
                .toList();
    }

    public void requireCredentials() {
        if (props.clientId() == null || props.clientId().isBlank()
                || props.clientSecret() == null || props.clientSecret().isBlank()) {
            throw new IllegalStateException("NAVER client credentials are missing");
        }
    }

    public static IsbnParts parseIsbn(String raw) {
        if (raw == null || raw.isBlank()) return new IsbnParts(null, null);
        String isbn10 = null;
        String isbn13 = null;
        var parts = raw.trim().split("\\s+");
        for (var part : parts) {
            var cleaned = part.replaceAll("[^0-9Xx]", "");
            if (cleaned.length() == 13) {
                isbn13 = cleaned;
            } else if (cleaned.length() == 10) {
                isbn10 = cleaned.toUpperCase();
            }
        }
        return new IsbnParts(isbn10, isbn13);
    }

    public static String providerIdFrom(IsbnParts parts, String link) {
        if (parts != null) {
            if (parts.isbn13() != null && !parts.isbn13().isBlank()) return parts.isbn13();
            if (parts.isbn10() != null && !parts.isbn10().isBlank()) return parts.isbn10();
        }
        if (link == null || link.isBlank()) return null;
        String hash = sha256(link);
        if (hash == null) return null;
        return hash.substring(0, Math.min(40, hash.length()));
    }

    private static String sha256(String value) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            var bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            var sb = new StringBuilder();
            for (byte b : bytes) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return value;
        }
    }

    public record IsbnParts(String isbn10, String isbn13) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class SearchResponse {
        @JsonProperty("items")
        List<SearchItem> items;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SearchItem {
        @JsonProperty("title")
        String title;
        @JsonProperty("link")
        String link;
        @JsonProperty("image")
        String image;
        @JsonProperty("author")
        String author;
        @JsonProperty("publisher")
        String publisher;
        @JsonProperty("isbn")
        String isbn;
        @JsonProperty("description")
        String description;
        @JsonProperty("pubdate")
        String pubdate;

        public String titleValue() { return normalize(title); }
        public String linkValue() { return link; }
        public String imageValue() { return blankToNull(image); }
        public String authorValue() { return normalizeAuthor(author); }
        public String publisherValue() { return normalize(publisher); }
        public String isbnValue() { return normalize(isbn); }
        public String descriptionValue() { return normalize(description); }
        public String pubdateValue() { return normalize(pubdate); }

        private static String normalize(String value) {
            if (value == null) return null;
            String stripped = value.replaceAll("<[^>]+>", "").trim();
            if (stripped.isBlank()) return null;
            return stripped.replace("&amp;", "&");
        }

        private static String normalizeAuthor(String value) {
            var normalized = normalize(value);
            if (normalized == null) return null;
            return normalized.replace("|", ", ").replace("^", " ");
        }

        private static String blankToNull(String value) {
            if (value == null || value.isBlank()) return null;
            return value;
        }
    }
}
