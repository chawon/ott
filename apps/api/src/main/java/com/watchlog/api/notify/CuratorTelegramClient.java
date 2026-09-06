package com.watchlog.api.notify;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;

import java.time.Duration;
import java.util.Map;

@Component
public class CuratorTelegramClient {
    private final TelegramProperties properties;
    private final RestClient client;

    @Autowired
    public CuratorTelegramClient(TelegramProperties properties) {
        this.properties = properties;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(5));
        this.client = RestClient.builder().baseUrl(properties.baseUrl()).requestFactory(factory).build();
    }

    public CuratorTelegramClient(TelegramProperties properties, RestClient client) {
        this.properties = properties;
        this.client = client;
    }

    public JsonNode call(String method, Map<String, Object> body) {
        try {
            var response = client.post().uri("/bot{token}/{method}", properties.botToken(), method)
                    .body(body).retrieve().body(JsonNode.class);
            if (response == null || !response.path("ok").asBoolean()) {
                throw new IllegalStateException("Telegram rejected " + method);
            }
            return response.path("result");
        } catch (RestClientResponseException ex) {
            if (method.equals("editMessageText") && ex.getStatusCode().value() == 400
                    && ex.getResponseBodyAsString().contains("message is not modified")) return null;
            // RestClient exceptions contain bot-token URLs. Never propagate/log the original exception.
            throw new IllegalStateException("Telegram " + method + " returned HTTP " + ex.getStatusCode().value());
        } catch (org.springframework.web.client.RestClientException ex) {
            throw new IllegalStateException("Telegram " + method + " transport failed");
        }
    }
}
