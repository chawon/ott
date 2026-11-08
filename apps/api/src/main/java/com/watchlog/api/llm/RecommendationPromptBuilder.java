package com.watchlog.api.llm;

import com.watchlog.api.domain.WatchLogEntity;

import java.util.List;
import java.util.stream.Collectors;

public class RecommendationPromptBuilder {

    private RecommendationPromptBuilder() {}

    public static String candidatePool(List<WatchLogEntity> logs, String language, List<String> excluded, int count) {
        if (count < 1 || count > 12) throw new IllegalArgumentException("Candidate count must be between 1 and 12");
        return build(logs, language, excluded) + """

                Candidate pool request:
                - Requested candidate count: %d distinct real works.
                - The server will choose six after applying catalog identities and exclusion rules.
                - The exclusion list also contains candidates already considered during this generation.
                - Avoid every title, original title, and localized alias in that list.
                - Use related themes or genres supported by the history when closer choices repeat.
                - Return fewer candidates only when you cannot confidently name enough suitable real works.
                """.formatted(count);
    }

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
                Help an ottline user find a few stories they might enjoy through the records they have kept.
                Consider their watching and reading history with care:
                - Internal feelings use a 1-5 scale: 5 is a strong favorite, 3 is a mixed or comfortable response, and 1 expresses disappointment. Older intermediate values remain valid.
                - Notes and the user's own words matter as much as a feeling value.
                - Place and company describe a remembered moment. Do not infer personality, demographics, or preferred pacing from them alone.

                User's history (제목 | 타입 | 장르 | 평점 | 장소 | 누구와 | 메모):
                %s
                %s
                Requirements:
                - Do NOT recommend anything already in the history
                - Do NOT recommend anything in the "already seen" list above
                - Mix content types if the user has logged multiple types
                - Prioritize genres and themes they rate highly
                - Reference actual titles from their log to explain why each recommendation fits
                - Write each reason as a brief, warm, plain-language invitation grounded in an actual title or note from the history
                - Do not mention numeric scores, rating scales, algorithms, AI analysis, or system terminology in reasons
                - Do not promise that a title will suit the user, tell them what they must watch or read, or create pressure to keep up
                - For the "name" field: use the original title (English or native language) for non-Korean works, Korean title for Korean works
                - Respond ONLY with a valid JSON array in this format, no extra text:
                [
                  {
                    "name": "작품명 (원제 또는 한국어 제목)",
                    "type": "movie|series|book",
                    "reason": "남겨둔 작품이나 메모와 이어지는 점을 짧고 편안한 말로 설명"
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
