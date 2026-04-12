package com.watchlog.api.llm;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "llm")
public record LlmProperties(
        String anthropicApiKey,
        String anthropicModel,
        String geminiApiKey,
        String geminiModel
) {}
