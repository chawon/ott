package com.watchlog.api.web;

import com.watchlog.api.llm.RecommendationItem;
import com.watchlog.api.service.AuthService;
import com.watchlog.api.service.RecommendationService;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {

    private final RecommendationService recommendationService;
    private final AuthService authService;

    public RecommendationController(RecommendationService recommendationService, AuthService authService) {
        this.recommendationService = recommendationService;
        this.authService = authService;
    }

    @GetMapping
    public List<RecommendationItem> get(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-Device-Id") UUID deviceId,
            @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String language,
            @RequestParam(defaultValue = "false") boolean refresh,
            @RequestParam(required = false) List<String> excluded
    ) {
        authService.requireActiveDevice(userId, deviceId);
        if (refresh) {
            recommendationService.invalidateCache(userId);
        }
        return recommendationService.getRecommendations(userId, language, excluded != null ? excluded : List.of());
    }
}
