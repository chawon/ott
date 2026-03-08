package com.watchlog.api.notify;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "notify.telegram")
public record TelegramProperties(
        boolean enabled,
        String botToken,
        String chatId,
        String baseUrl,
        String serviceName
) {
    public TelegramProperties {
        if (baseUrl == null || baseUrl.isBlank()) baseUrl = "https://api.telegram.org";
        if (botToken == null) botToken = "";
        if (chatId == null) chatId = "";
        if (serviceName == null || serviceName.isBlank()) serviceName = "ottline";
    }

    public boolean isConfigured() {
        return enabled && !botToken.isBlank() && !chatId.isBlank();
    }
}
