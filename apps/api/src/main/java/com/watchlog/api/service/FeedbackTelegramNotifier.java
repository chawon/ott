package com.watchlog.api.service;

import com.watchlog.api.domain.FeedbackMessageEntity;
import com.watchlog.api.domain.FeedbackThreadEntity;
import com.watchlog.api.notify.TelegramProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Service
public class FeedbackTelegramNotifier {

    private static final Logger log = LoggerFactory.getLogger(FeedbackTelegramNotifier.class);

    private final RestClient telegramRestClient;
    private final TelegramProperties telegramProperties;

    public FeedbackTelegramNotifier(
            @Qualifier("telegramRestClient") RestClient telegramRestClient,
            TelegramProperties telegramProperties
    ) {
        this.telegramRestClient = telegramRestClient;
        this.telegramProperties = telegramProperties;
    }

    public void notifyNewThread(FeedbackThreadEntity thread, FeedbackMessageEntity message) {
        if (!telegramProperties.isConfigured()) {
            return;
        }

        try {
            telegramRestClient.post()
                    .uri("/bot{token}/sendMessage", telegramProperties.botToken())
                    .body(Map.of(
                            "chat_id", telegramProperties.chatId(),
                            "text", buildMessage(thread, message),
                            "disable_web_page_preview", true
                    ))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Failed to send Telegram notification for feedback thread {}", thread.getId(), e);
        }
    }

    private String buildMessage(FeedbackThreadEntity thread, FeedbackMessageEntity message) {
        StringBuilder text = new StringBuilder();
        text.append("[").append(telegramProperties.serviceName()).append("] 새 문의 도착\n");
        text.append("카테고리: ").append(thread.getCategory().name()).append("\n");
        if (thread.getSubject() != null && !thread.getSubject().isBlank()) {
            text.append("제목: ").append(thread.getSubject().trim()).append("\n");
        }
        text.append("user: ").append(shortId(thread.getUserId().toString())).append("\n");
        text.append("본문: ").append(preview(message.getBody()));
        return text.toString();
    }

    private String shortId(String value) {
        return value.length() <= 8 ? value : value.substring(0, 8);
    }

    private String preview(String body) {
        String normalized = body == null ? "" : body.trim().replaceAll("\\s+", " ");
        if (normalized.length() <= 280) {
            return normalized;
        }
        return normalized.substring(0, 277) + "...";
    }
}
