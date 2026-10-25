package com.watchlog.api.googlebooks;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "google-books")
public record GoogleBooksProperties(String baseUrl, String apiKey) {
    public GoogleBooksProperties {
        if (baseUrl == null || baseUrl.isBlank()) baseUrl = "https://www.googleapis.com";
        apiKey = apiKey == null ? "" : apiKey.trim();
    }
}
