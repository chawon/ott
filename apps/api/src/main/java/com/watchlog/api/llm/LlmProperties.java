package com.watchlog.api.llm;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "llm")
public record LlmProperties(
        String anthropicApiKey,
        String anthropicModel,
        String geminiApiKey,
        String geminiModel,
        String openaiApiKey,
        String openaiModel,
        String openaiBaseUrl,
        String openaiReasoningEffort
) {
    public LlmProperties {
        openaiModel = openaiModel == null || openaiModel.isBlank() ? "gpt-6-luna" : openaiModel.strip();
        openaiBaseUrl = openaiBaseUrl == null || openaiBaseUrl.isBlank() ? "https://api.openai.com" : openaiBaseUrl;
        openaiReasoningEffort = openaiReasoningEffort == null ? "low" : openaiReasoningEffort.strip();
    }
}
