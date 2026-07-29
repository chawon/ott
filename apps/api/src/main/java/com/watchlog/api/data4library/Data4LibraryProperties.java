package com.watchlog.api.data4library;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "data4library")
public record Data4LibraryProperties(
        String baseUrl,
        String authKey
) {
    public Data4LibraryProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "https://data4library.kr";
        }
        if (authKey == null) {
            authKey = "";
        }
    }

    public boolean configured() {
        return !authKey.isBlank();
    }
}
