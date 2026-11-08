package com.watchlog.api.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.watchlog.api.domain.Occasion;
import com.watchlog.api.domain.Place;
import com.watchlog.api.domain.Status;
import com.watchlog.api.domain.TitleEntity;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.domain.WatchLogEntity;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class RecommendationPromptBuilderTest {
    @Test
    void keepsExistingHistoryValuesExclusionsAndLanguageWhileFormattingNotes() {
        var title = new TitleEntity(UUID.randomUUID(), TitleType.movie, "Quiet Days");
        title.setGenres(new String[]{"Drama"});
        var log = new WatchLogEntity(UUID.randomUUID(), title, Status.DONE);
        log.setRating(new BigDecimal("4.5"));
        log.setPlace(Place.TRANSIT);
        log.setOccasion(Occasion.ALONE);
        log.setNote("A quiet ending.\nWorth returning to.");

        var prompt = RecommendationPromptBuilder.build(
                List.of(log), "ko-KR", List.of("An earlier film", "A book already read"));

        assertThat(prompt).containsPattern(
                "Quiet Days \\| movie \\| Drama \\| 4[.,]5 \\| TRANSIT \\| ALONE \\| A quiet ending\\. Worth returning to\\.");
        assertThat(prompt).contains("An earlier film", "A book already read", "Respond in Korean.");
        assertThat(prompt).contains("Do NOT recommend anything already in the history",
                "Do NOT recommend anything in the \"already seen\" list above",
                "Mix content types if the user has logged multiple types");
        assertThat(log.getRating()).isEqualByComparingTo("4.5");
        assertThat(log.getNote()).isEqualTo("A quiet ending.\nWorth returning to.");
    }

    @Test
    void keepsTheJsonResponseContractAndEnglishFallback() throws Exception {
        var prompt = RecommendationPromptBuilder.build(List.of(), null, null);
        var example = Pattern.compile("(?s)\\[\\s*\\{.*?}\\s*]").matcher(prompt);
        assertThat(example.find()).isTrue();
        var json = new ObjectMapper().readTree(example.group());

        assertThat(json.isArray()).isTrue();
        assertThat(json.size()).isEqualTo(1);
        assertThat(json.get(0).properties()).extracting(java.util.Map.Entry::getKey)
                .containsExactlyInAnyOrder("name", "type", "reason");
        assertThat(json.get(0).get("type").asText()).isEqualTo("movie|series|book");
        assertThat(prompt).contains("Respond ONLY with a valid JSON array", "Respond in English.");
        assertThat(prompt).contains("original title (English or native language) for non-Korean works, Korean title for Korean works");
    }

    @Test
    void candidatePoolsRequestAnExplicitCountAndKeepKnownNamesOutOfTheRefill() {
        var prompt = RecommendationPromptBuilder.candidatePool(List.of(), "ko", List.of("An already considered title", "그 작품의 번역 제목"), 12);
        assertThat(prompt).contains("Requested candidate count: 12", "An already considered title", "그 작품의 번역 제목", "Respond in Korean.");
        assertThat(prompt).contains("already considered during this generation", "confidently name enough suitable real works");
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> RecommendationPromptBuilder.candidatePool(List.of(), "en", List.of(), 13))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
