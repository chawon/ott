package com.watchlog.api.service;

import com.watchlog.api.domain.TitleType;
import org.springframework.stereotype.Component;

@Component
public class CuratedPromptGenerator {

    public String generateVariant(String titleName, TitleType titleType, String locale, int revision) {
        if (revision == 0) return generate(titleName, titleType, locale);
        boolean book = titleType == TitleType.book;
        if ("en".equals(locale)) {
            return switch (Math.floorMod(revision, 4)) {
                case 1 -> "What would you like to remember about “" + titleName + "”?";
                case 2 -> "How did you feel after " + (book ? "reading" : "watching") + " “" + titleName + "”?";
                case 3 -> "Which moment in “" + titleName + "” would you return to?";
                default -> generate(titleName, titleType, locale);
            };
        }
        return switch (Math.floorMod(revision, 4)) {
            case 1 -> titleName + "에서 나중에도 기억하고 싶은 것은 무엇인가요?";
            case 2 -> titleName + (book ? "을 읽고" : "을 보고") + " 어떤 기분이 들었나요?";
            case 3 -> titleName + "에서 다시 돌아가 보고 싶은 순간은 언제인가요?";
            default -> generate(titleName, titleType, locale);
        };
    }

    public String generate(String titleName, TitleType titleType, String locale) {
        if ("en".equals(locale)) {
            return switch (titleType) {
                case book -> "What sentence or idea from \u201c" + titleName + "\u201d has stayed with you?";
                case movie, series -> "What scene or feeling from \u201c" + titleName + "\u201d has stayed with you the longest?";
            };
        }
        return switch (titleType) {
            case book -> titleName + "에서 지금도 마음에 남아 있는 문장이나 생각은 무엇인가요?";
            case movie, series -> titleName + "에서 가장 오래 남은 장면이나 감정은 무엇인가요?";
        };
    }
}
