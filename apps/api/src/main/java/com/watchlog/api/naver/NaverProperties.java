package com.watchlog.api.naver;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "naver")
public record NaverProperties(
        String baseUrl,
        String clientId,
        String clientSecret
) {
    public NaverProperties {
        if (baseUrl == null || baseUrl.isBlank()) baseUrl = "https://openapi.naver.com";
        if (clientId == null) clientId = "";
        if (clientSecret == null) clientSecret = "";
    }
}
