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

        String languageInstruction = (language != null && language.startsWith("ko"))
                ? "Respond in Korean."
                : "Respond in English.";

        String excludedSection = "";
        if (excluded != null && !excluded.isEmpty()) {
            String excludedLines = String.join("\n", excluded);
            excludedSection = """

                Additionally, the user has already seen these titles — do NOT recommend them:
                %s
                """.formatted(excludedLines);
        }

        return """
                You are a content recommendation engine. Based on the user's watch/read history below,
                recommend 5-10 movies, TV series, or books they haven't seen yet.

                User's history (title | type | genres | rating out of 5):
                %s
                %s
                Requirements:
                - Do NOT recommend anything already in the history above
                - Do NOT recommend anything in the "already seen" list above
                - Mix content types if the user has logged multiple types
                - Prioritize genres and themes they rate highly
                - Respond ONLY with a valid JSON array, no extra text, in this exact format:
                [
                  {
                    "name": "Title name",
                    "type": "movie|series|book",
                    "reason": "One sentence why this matches their taste",
                    "genres": ["Genre1", "Genre2"]
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
        return "%s | %s | %s | %s".formatted(title, type, genres, rating);
    }
}
