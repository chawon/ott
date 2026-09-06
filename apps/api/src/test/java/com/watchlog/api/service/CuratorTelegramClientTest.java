package com.watchlog.api.service;

import com.watchlog.api.notify.CuratorTelegramClient;
import com.watchlog.api.notify.TelegramProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class CuratorTelegramClientTest {
    private final RestClient.Builder builder = RestClient.builder().baseUrl("https://api.telegram.org");
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final CuratorTelegramClient client = new CuratorTelegramClient(
            new TelegramProperties(true, "secret-test-token", "123", null, null), builder.build());

    @Test
    void sendsJsonAndReadsTelegramEnvelope() {
        server.expect(requestTo("https://api.telegram.org/botsecret-test-token/sendMessage"))
                .andExpect(method(HttpMethod.POST)).andExpect(content().json("{\"chat_id\":\"123\",\"text\":\"승인 대기\"}"))
                .andRespond(withSuccess("{\"ok\":true,\"result\":{\"message_id\":12}}", MediaType.APPLICATION_JSON));
        assertThat(client.call("sendMessage", Map.of("chat_id", "123", "text", "승인 대기")).path("message_id").asLong()).isEqualTo(12);
        server.verify();
    }

    @Test
    void editReplayIsSuccessfulWhenTelegramAlreadyHasTheSameMessage() {
        server.expect(requestTo("https://api.telegram.org/botsecret-test-token/editMessageText"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST).body("{\"ok\":false,\"description\":\"Bad Request: message is not modified\"}"));
        assertThat(client.call("editMessageText", Map.of())).isNull();
    }

    @Test
    void rejectsApiFailureWithoutExposingTokenOrResponseBody() {
        server.expect(requestTo("https://api.telegram.org/botsecret-test-token/getUpdates"))
                .andRespond(withStatus(HttpStatus.CONFLICT).body("sensitive response"));
        assertThatThrownBy(() -> client.call("getUpdates", Map.of()))
                .hasMessage("Telegram getUpdates returned HTTP 409").hasNoCause();
    }
}
