package com.watchlog.api.web;

import com.watchlog.api.llm.RecommendationItem;
import com.watchlog.api.dto.RecommendationState;
import com.watchlog.api.dto.TitleSearchItemDto;
import com.watchlog.api.service.AuthService;
import com.watchlog.api.service.RecommendationAccountStore;
import com.watchlog.api.service.RecommendationCatalogService;
import com.watchlog.api.service.RecommendationService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {

    @ModelAttribute
    void preventCaching(jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
    }

    private final RecommendationService recommendationService;
    private final AuthService authService;
    private final RecommendationAccountStore store;
    private final RecommendationCatalogService catalog;

    public RecommendationController(RecommendationService recommendationService, AuthService authService,
            RecommendationAccountStore store, RecommendationCatalogService catalog) {
        this.recommendationService = recommendationService;
        this.authService = authService;
        this.store = store;
        this.catalog = catalog;
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
        return recommendationService.getRecommendations(userId, language, excluded != null ? excluded : List.of(), refresh);
    }

    @GetMapping("/state")
    public RecommendationState state(@RequestHeader("X-User-Id") UUID userId, @RequestHeader("X-Device-Id") UUID deviceId,
            @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String language) {
        authService.requireActiveDevice(userId, deviceId);
        return recommendationService.state(userId, language);
    }

    public record GenerateRequest(UUID requestId) {}

    @PostMapping("/generate")
    public ResponseEntity<RecommendationState> generate(@RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-Device-Id") UUID deviceId,
            @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String language,
            @RequestBody GenerateRequest request) {
        authService.requireActiveDevice(userId, deviceId);
        var result = recommendationService.generate(userId, language, request == null ? null : request.requestId());
        return ResponseEntity.status(result.status()).cacheControl(org.springframework.http.CacheControl.noStore()).body(result.state());
    }

    @GetMapping("/exclusions")
    public List<java.util.Map<String, Object>> exclusions(@RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-Device-Id") UUID deviceId) {
        authService.requireActiveDevice(userId, deviceId);
        return store.exclusions(userId).stream().map(RecommendationAccountStore.Exclusion::view).toList();
    }

    @PutMapping("/exclusions")
    public java.util.Map<String, Object> exclude(@RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-Device-Id") UUID deviceId, @RequestBody RecommendationItem item) {
        authService.requireActiveDevice(userId, deviceId);
        return store.putExclusion(userId, item).view();
    }

    @DeleteMapping("/exclusions/{key}")
    public void restore(@RequestHeader("X-User-Id") UUID userId, @RequestHeader("X-Device-Id") UUID deviceId,
            @PathVariable String key) {
        authService.requireActiveDevice(userId, deviceId);
        store.removeExclusion(userId, key);
    }

    @GetMapping("/catalog")
    public List<TitleSearchItemDto> catalog(@RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-Device-Id") UUID deviceId,
            @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String language,
            @RequestParam String name, @RequestParam String type,
            @RequestParam(required = false) Integer year, @RequestParam(required = false) String author) {
        authService.requireActiveDevice(userId, deviceId);
        return catalog.search(name, type, year, author, RecommendationService.normalizeLanguage(language));
    }
}
