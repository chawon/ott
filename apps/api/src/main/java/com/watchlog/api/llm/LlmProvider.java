package com.watchlog.api.llm;

import java.util.List;

public interface LlmProvider {
    List<RecommendationItem> recommend(String prompt);
    boolean isEnabled();
}
