package com.watchlog.api.kakao;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "kakao")
public record KakaoProperties(String baseUrl, String restApiKey) {
    public KakaoProperties {
        if (baseUrl == null || baseUrl.isBlank()) baseUrl = "https://dapi.kakao.com";
        restApiKey = restApiKey == null ? "" : restApiKey.trim();
    }
}
