package com.watchlog.api.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.net.InetSocketAddress;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class OpenAiProviderTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String ITEMS = """
            {"recommendations":[{"name":"A New Story","type":"movie","reason":"A gentle connection",
            "genres":["Drama"],"year":2020}]}
            """;

    @Test
    void productionClientUsesResponsesAuthenticationAndStrictStructuredOutput() throws Exception {
        var authorization = new AtomicReference<String>();
        var uri = new AtomicReference<String>();
        var request = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/responses", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            uri.set(exchange.getRequestURI().toString());
            request.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body = response(ITEMS).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (var out = exchange.getResponseBody()) { out.write(body); }
        });
        server.start();
        try {
            var props = props("http://127.0.0.1:" + server.getAddress().getPort(), "gpt-6-luna", "low");
            var provider = new OpenAiProvider(new LlmConfig().openaiRestClient(props), props);
            assertThat(provider.recommend("synthetic history")).singleElement().satisfies(item -> {
                assertThat(item.name()).isEqualTo("A New Story");
                assertThat(item.year()).isEqualTo(2020);
            });
            assertThat(authorization.get()).isEqualTo("Bearer test-key");
            assertThat(uri.get()).isEqualTo("/v1/responses");
            var body = JSON.readTree(request.get());
            assertThat(body.path("model").asText()).isEqualTo("gpt-6-luna");
            assertThat(body.path("input").asText()).isEqualTo("synthetic history");
            assertThat(body.path("store").asBoolean()).isFalse();
            assertThat(body.path("reasoning").path("effort").asText()).isEqualTo("low");
            assertThat(body.path("max_output_tokens").asInt()).isEqualTo(6000);
            var format = body.path("text").path("format");
            assertThat(format.path("type").asText()).isEqualTo("json_schema");
            assertThat(format.path("strict").asBoolean()).isTrue();
            assertThat(format.path("schema").path("additionalProperties").asBoolean()).isFalse();
            assertThat(format.path("schema").path("properties").path("recommendations").path("maxItems").asInt()).isEqualTo(12);
            assertThat(format.path("schema").path("properties").path("recommendations").path("items")
                    .path("required").toString()).contains("year");
        } finally { server.stop(0); }
    }

    @Test
    void skipsReasoningParameterForModelsThatDoNotSupportIt() throws Exception {
        var builder = RestClient.builder().baseUrl("https://api.openai.com");
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.openai.com/v1/responses"))
                .andExpect(content().json("{\"model\":\"gpt-4.1-mini\"}"))
                .andExpect(jsonPath("$.reasoning").doesNotExist())
                .andRespond(withSuccess(response("{\"recommendations\":[]}"), MediaType.APPLICATION_JSON));
        assertThat(new OpenAiProvider(builder.build(), props(null, "gpt-4.1-mini", "low")).recommend("synthetic")).isEmpty();
        server.verify();
    }

    @Test
    void rejectsIncompleteRefusedAndMalformedOutputs() throws Exception {
        for (String raw : List.of("{}", "null", "not json", "{\"status\":\"incomplete\",\"output\":[]}",
                "{\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"refusal\",\"refusal\":\"no\"}]}]}",
                response("{}"), response("{\"recommendations\":[{\"name\":\"Bad\",\"type\":\"unknown\"}]}"))) {
            var builder = RestClient.builder().baseUrl("https://api.openai.com");
            var server = MockRestServiceServer.bindTo(builder).build();
            server.expect(anything()).andRespond(withSuccess(raw, MediaType.APPLICATION_JSON));
            assertThatThrownBy(() -> new OpenAiProvider(builder.build(), props(null, null, "low")).recommend("private history"))
                    .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                        assertThat(error.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                        assertThat(error).hasNoCause().hasMessageNotContaining("private history");
                    });
        }
    }

    @Test
    void mapsHttpAndTimeoutFailuresWithoutExposingCredentialsOrProviderBodies() {
        for (var status : List.of(HttpStatus.UNAUTHORIZED, HttpStatus.TOO_MANY_REQUESTS, HttpStatus.INTERNAL_SERVER_ERROR)) {
            var builder = RestClient.builder().baseUrl("https://api.openai.com");
            var server = MockRestServiceServer.bindTo(builder).build();
            server.expect(anything()).andRespond(withStatus(status).body("sensitive upstream body test-key"));
            assertUnavailableWithoutSensitiveText(new OpenAiProvider(builder.build(), props(null, null, "low")));
        }
        var builder = RestClient.builder().baseUrl("https://api.openai.com");
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(anything()).andRespond(withException(new SocketTimeoutException("sensitive network details")));
        assertUnavailableWithoutSensitiveText(new OpenAiProvider(builder.build(), props(null, null, "low")));
    }

    @Test
    void aMissingKeyDoesNotSendAnUpstreamRequest() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var props = new LlmProperties(null, null, null, null, " ", null, null, null);
        var provider = new OpenAiProvider(builder.build(), props);
        assertThat(provider.isEnabled()).isFalse();
        assertUnavailableWithoutSensitiveText(provider);
        server.verify();
    }

    @Test
    void acceptsATwelveCandidatePoolAndRejectsAnUnboundedPool() throws Exception {
        for (int size : List.of(12, 13)) {
            var items = java.util.stream.IntStream.range(0, size).mapToObj(index -> Map.of(
                    "name", "Story " + index, "type", "movie", "reason", "A connection", "genres", List.of(), "year", 2020)).toList();
            var builder = RestClient.builder().baseUrl("https://api.openai.com");
            var server = MockRestServiceServer.bindTo(builder).build();
            server.expect(anything()).andRespond(withSuccess(response(JSON.writeValueAsString(Map.of("recommendations", items))), MediaType.APPLICATION_JSON));
            var provider = new OpenAiProvider(builder.build(), props(null, null, "low"));
            if (size == 12) assertThat(provider.recommend("A synthetic candidate pool")).hasSize(12);
            else assertUnavailableWithoutSensitiveText(provider);
            server.verify();
        }
    }

    private static void assertUnavailableWithoutSensitiveText(OpenAiProvider provider) {
        assertThatThrownBy(() -> provider.recommend("private history"))
                .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                    assertThat(error.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                    assertThat(error).hasNoCause().hasMessageNotContaining("test-key").hasMessageNotContaining("sensitive")
                            .hasMessageNotContaining("private history");
                });
    }

    private static LlmProperties props(String base, String model, String reasoning) {
        return new LlmProperties(null, null, null, null, "test-key", model, base, reasoning);
    }

    private static String response(String text) throws java.io.IOException {
        return JSON.writeValueAsString(Map.of("status", "completed", "output", List.of(
                Map.of("type", "reasoning", "summary", List.of()),
                Map.of("type", "message", "content", List.of(Map.of("type", "output_text", "text", text))))));
    }
}
