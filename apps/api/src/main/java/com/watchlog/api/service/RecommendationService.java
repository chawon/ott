package com.watchlog.api.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.watchlog.api.domain.RecommendationCacheEntity;
import com.watchlog.api.domain.WatchLogEntity;
import com.watchlog.api.llm.LlmProvider;
import com.watchlog.api.llm.RecommendationItem;
import com.watchlog.api.llm.RecommendationPromptBuilder;
import com.watchlog.api.tmdb.TmdbClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.watchlog.api.repo.RecommendationCacheRepository;
import com.watchlog.api.repo.WatchLogRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class RecommendationService {

    private static final Logger log = LoggerFactory.getLogger(RecommendationService.class);
    private static final int CACHE_HOURS = 24;
    private static final int MIN_LOGS_REQUIRED = 5;
    private static final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final WatchLogRepository watchLogRepository;
    private final RecommendationCacheRepository cacheRepository;
    private final List<LlmProvider> llmProviders;
    private final TmdbClient tmdbClient;

    public RecommendationService(
            WatchLogRepository watchLogRepository,
            RecommendationCacheRepository cacheRepository,
            List<LlmProvider> llmProviders,
            TmdbClient tmdbClient) {
        this.watchLogRepository = watchLogRepository;
        this.cacheRepository = cacheRepository;
        this.llmProviders = llmProviders;
        this.tmdbClient = tmdbClient;
    }

    @Transactional
    public List<RecommendationItem> getRecommendations(UUID userId, String language, List<String> excluded) {
        String lang = language != null ? language : "ko";

        var cached = cacheRepository.findByUserId(userId);
        if (cached.isPresent()) {
            var entry = cached.get();
            if (entry.getCreatedAt().isAfter(OffsetDateTime.now().minusHours(CACHE_HOURS))) {
                return deserialize(entry.getResponseJson());
            }
        }

        OffsetDateTime since = OffsetDateTime.now().minusMonths(3);
        List<WatchLogEntity> logs = watchLogRepository.findTop50ForRecommendation(
                userId, since, PageRequest.of(0, 50));

        log.info("[Recommendation] userId={} DONE logs (last 3 months) found: {}", userId, logs.size());

        if (logs.size() < MIN_LOGS_REQUIRED) {
            log.info("[Recommendation] Not enough logs ({}), returning empty", logs.size());
            return List.of();
        }

        // 사용자 시청 이력 타이틀명 (소문자) — LLM 결과 dedup에 사용
        Set<String> watchedTitles = logs.stream()
                .map(w -> w.getTitle().getName().toLowerCase().strip())
                .collect(java.util.stream.Collectors.toSet());

        // excluded (프론트에서 "이미 봤다" 체크한 목록)도 소문자로 추가
        if (excluded != null) {
            excluded.stream()
                    .map(s -> s.toLowerCase().strip())
                    .forEach(watchedTitles::add);
        }

        String prompt = RecommendationPromptBuilder.build(logs, lang, excluded);
        log.info("[Recommendation] Calling {} provider(s)", llmProviders.stream().filter(LlmProvider::isEnabled).count());
        List<RecommendationItem> items = callAllProviders(prompt);

        // 시청 이력 + excluded와 중복 제거
        items = items.stream()
                .filter(item -> !watchedTitles.contains(item.name().toLowerCase().strip()))
                .toList();

        log.info("[Recommendation] Got {} items after dedup", items.size());
        items = enrichWithPosters(items, lang);

        saveCache(userId, lang, items);

        return items;
    }

    private List<RecommendationItem> enrichWithPosters(List<RecommendationItem> items, String language) {
        List<CompletableFuture<RecommendationItem>> futures = items.stream()
                .map(item -> CompletableFuture.supplyAsync(() -> {
                    if ("book".equals(item.type())) return item;
                    String posterUrl = tmdbClient.findPosterUrl(item.name(), item.type(), language);
                    return new RecommendationItem(item.name(), item.type(), item.reason(), item.genres(), posterUrl);
                }, executor))
                .toList();

        return futures.stream()
                .map(CompletableFuture::join)
                .toList();
    }

    private List<RecommendationItem> callAllProviders(String prompt) {
        List<LlmProvider> enabled = llmProviders.stream()
                .filter(LlmProvider::isEnabled)
                .toList();

        if (enabled.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "No LLM provider configured");
        }

        List<CompletableFuture<List<RecommendationItem>>> futures = enabled.stream()
                .map(provider -> CompletableFuture.supplyAsync(() -> {
                    try {
                        return provider.recommend(prompt);
                    } catch (Exception e) {
                        log.warn("LLM provider {} failed: {}", provider.getClass().getSimpleName(), e.getMessage());
                        return List.<RecommendationItem>of();
                    }
                }, executor))
                .toList();

        // 모든 응답 수집 후 이름 기준 중복 제거 (먼저 온 결과 우선)
        var seen = new LinkedHashMap<String, RecommendationItem>();
        for (var future : futures) {
            try {
                future.join().forEach(item ->
                        seen.putIfAbsent(item.name().toLowerCase().strip(), item)
                );
            } catch (Exception e) {
                log.warn("Failed to collect LLM result: {}", e.getMessage());
            }
        }

        if (seen.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "All LLM providers failed");
        }

        return new ArrayList<>(seen.values());
    }

    @Transactional
    public void invalidateCache(UUID userId) {
        cacheRepository.deleteByUserId(userId);
    }

    private void saveCache(UUID userId, String language, List<RecommendationItem> items) {
        try {
            String json = OBJECT_MAPPER.writeValueAsString(items);
            var entry = new RecommendationCacheEntity(userId, language, json, OffsetDateTime.now());
            cacheRepository.save(entry);
        } catch (JsonProcessingException e) {
            // 캐시 저장 실패는 무시 - 응답은 그대로 반환
        }
    }

    private List<RecommendationItem> deserialize(String json) {
        try {
            return OBJECT_MAPPER.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }
}
