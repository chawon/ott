package com.watchlog.api.llm;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Component
public class AnthropicProvider implements LlmProvider {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final RestClient restClient;
    private final LlmProperties props;

    public AnthropicProvider(
            @Qualifier("anthropicRestClient") RestClient restClient,
            LlmProperties props) {
        this.restClient = restClient;
        this.props = props;
    }

    @Override
    public boolean isEnabled() {
        return props.anthropicApiKey() != null && !props.anthropicApiKey().isBlank();
    }

    @Override
    public List<RecommendationItem> recommend(String prompt) {
        var body = Map.of(
                "model", props.anthropicModel() != null ? props.anthropicModel() : "claude-opus-4-5",
                "max_tokens", 2048,
                "messages", List.of(Map.of("role", "user", "content", prompt))
        );

        String responseText = restClient.post()
                .uri("/v1/messages")
                .body(body)
                .retrieve()
                .body(AnthropicResponse.class)
                .content().get(0).text();

        return parseJson(responseText);
    }

    private List<RecommendationItem> parseJson(String text) {
        try {
            String json = extractJsonArray(text);
            return OBJECT_MAPPER.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to parse Anthropic response as JSON: " + text, e);
        }
    }

    private String extractJsonArray(String text) {
        int start = text.indexOf('[');
        int end = text.lastIndexOf(']');
        if (start == -1 || end == -1) {
            throw new RuntimeException("No JSON array found in response: " + text);
        }
        return text.substring(start, end + 1);
    }

    record AnthropicResponse(List<ContentBlock> content) {}
    record ContentBlock(String type, String text) {}
}
