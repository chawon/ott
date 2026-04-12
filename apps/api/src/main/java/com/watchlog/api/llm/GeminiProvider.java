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
public class GeminiProvider implements LlmProvider {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final RestClient restClient;
    private final LlmProperties props;

    public GeminiProvider(
            @Qualifier("geminiRestClient") RestClient restClient,
            LlmProperties props) {
        this.restClient = restClient;
        this.props = props;
    }

    @Override
    public boolean isEnabled() {
        return props.geminiApiKey() != null && !props.geminiApiKey().isBlank();
    }

    @Override
    public List<RecommendationItem> recommend(String prompt) {
        String model = props.geminiModel() != null ? props.geminiModel() : "gemini-2.0-flash";
        String apiKey = props.geminiApiKey();

        var body = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))
                )
        );

        String responseText = restClient.post()
                .uri("/v1beta/models/{model}:generateContent?key={apiKey}", model, apiKey)
                .body(body)
                .retrieve()
                .body(GeminiResponse.class)
                .candidates().get(0).content().parts().get(0).text();

        return parseJson(responseText);
    }

    private List<RecommendationItem> parseJson(String text) {
        try {
            String json = extractJsonArray(text);
            return OBJECT_MAPPER.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to parse Gemini response as JSON: " + text, e);
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

    record GeminiResponse(List<Candidate> candidates) {}
    record Candidate(Content content) {}
    record Content(List<Part> parts) {}
    record Part(String text) {}
}
