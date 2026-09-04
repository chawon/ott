package com.watchlog.api.service;

import com.watchlog.api.domain.TitleType;
import org.springframework.stereotype.Component;

@Component
public class CuratedPromptGenerator {

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
