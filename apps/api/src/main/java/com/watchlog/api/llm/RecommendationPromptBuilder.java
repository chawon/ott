package com.watchlog.api.llm;

import com.watchlog.api.domain.WatchLogEntity;

import java.util.List;
import java.util.stream.Collectors;

public class RecommendationPromptBuilder {

    private RecommendationPromptBuilder() {}

    public static String build(List<WatchLogEntity> logs, String language, List<String> excluded) {
        String historyLines = logs.stream()
                .map(RecommendationPromptBuilder::formatLog)
                .collect(Collectors.joining("\n"));

        String excludedSection = "";
        if (excluded != null && !excluded.isEmpty()) {
            String excludedLines = String.join("\n", excluded);
            excludedSection = """

                    Additionally, the user has already seen these titles — do NOT recommend them:
                    %s
                    """.formatted(excludedLines);
        }

        String languageInstruction = (language != null && language.startsWith("ko"))
                ? "Respond in Korean."
                : "Respond in English.";

        return """
                You are a personal content recommendation engine for ottline.
                The user will provide their watch/read log.
                Analyze patterns across:
                - 평점 (1-5): 5점 = loved, 1점 = hated
                - 메모: tone and specific complaints matter as much as the rating
                - 장소/누구와: context matters (이동 중 혼자 = high-momentum content preferred)

                User's history (제목 | 타입 | 장르 | 평점 | 장소 | 누구와 | 메모):
                %s
                %s
                Requirements:
                - Do NOT recommend anything already in the history
                - Do NOT recommend anything in the "already seen" list above
                - Mix content types if the user has logged multiple types
                - Prioritize genres and themes they rate highly
                - Reference actual titles from their log to explain why each recommendation fits
                - For the "name" field: use the original title (English or native language) for non-Korean works, Korean title for Korean works
                - Respond ONLY with a valid JSON array in this format, no extra text:
                [
                  {
                    "name": "작품명 (원제 또는 한국어 제목)",
                    "type": "movie|series|book",
                    "reason": "기록의 특정 작품/메모를 언급하며 왜 맞는지 설명"
                  }
                ]
                %s
                """.formatted(historyLines, excludedSection, languageInstruction);
    }

    private static String formatLog(WatchLogEntity log) {
        String title = log.getTitle() != null ? log.getTitle().getName() : "Unknown";
        String type = log.getTitle() != null && log.getTitle().getType() != null
                ? log.getTitle().getType().name()
                : "movie";
        String genres = "(no genre)";
        if (log.getTitle() != null && log.getTitle().getGenres() != null && log.getTitle().getGenres().length > 0) {
            genres = String.join(", ", log.getTitle().getGenres());
        }
        String rating = log.getRating() != null ? String.format("%.1f", log.getRating()) : "N/A";
        String place = log.getPlace() != null ? log.getPlace().name() : "";
        String occasion = log.getOccasion() != null ? log.getOccasion().name() : "";
        String note = log.getNote() != null ? log.getNote().replace("\n", " ").strip() : "";

        return "%s | %s | %s | %s | %s | %s | %s".formatted(title, type, genres, rating, place, occasion, note);
    }
}
