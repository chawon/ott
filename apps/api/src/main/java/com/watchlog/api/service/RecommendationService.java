package com.watchlog.api.service;

import com.watchlog.api.domain.WatchLogEntity;
import com.watchlog.api.dto.RecommendationState;
import com.watchlog.api.llm.LlmProvider;
import com.watchlog.api.llm.RecommendationItem;
import com.watchlog.api.llm.RecommendationPromptBuilder;
import com.watchlog.api.repo.WatchLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class RecommendationService {
    private static final Logger log = LoggerFactory.getLogger(RecommendationService.class);
    private static final int MIN_LOGS_REQUIRED = 5;
    private static final int TARGET_COUNT = 6;
    private static final int CANDIDATE_POOL_SIZE = 12;
    private static final ExecutorService EXECUTOR = Executors.newVirtualThreadPerTaskExecutor();
    private final WatchLogRepository logs;
    private final RecommendationAccountStore store;
    private final List<LlmProvider> providers;
    private final RecommendationCatalogService catalog;

    public RecommendationService(WatchLogRepository logs, RecommendationAccountStore store,
            List<LlmProvider> providers, RecommendationCatalogService catalog) {
        this.logs = logs;
        this.store = store;
        this.providers = providers;
        this.catalog = catalog;
    }

    public record Generation(HttpStatus status, RecommendationState state) {}

    public RecommendationState state(UUID userId, String language) {
        return state(userId, normalizeLanguage(language), List.of());
    }

    private RecommendationState state(UUID userId, String language, List<String> legacyExcluded) {
        return store.readSnapshot(() -> readState(userId, language, legacyExcluded));
    }

    private RecommendationState readState(UUID userId, String language, List<String> legacyExcluded) {
        var stored = store.exclusions(userId);
        var batch = store.batch(userId, language);
        var items = batch.map(RecommendationAccountStore.Batch::items).orElse(List.of());
        items = RecommendationTitleMatcher.filter(items, logs.findTitlesForRecommendationExclusion(userId), legacyExcluded,
                stored.stream().map(RecommendationAccountStore.Exclusion::item).toList());
        boolean hasBatch = batch.isPresent() && store.isToday(batch.get().generatedAt())
                && providerKey().equals(batch.get().providerKey());
        return new RecommendationState(items, stored.stream().map(RecommendationAccountStore.Exclusion::view).toList(),
                store.quota(userId), batch.map(RecommendationAccountStore.Batch::generatedAt).orElse(null),
                batch.map(RecommendationAccountStore.Batch::generationId).orElse(null), store.generating(userId), hasBatch,
                logs.countForRecommendation(userId) >= MIN_LOGS_REQUIRED);
    }

    public Generation generate(UUID userId, String language, UUID requestId) {
        return generate(userId, language, requestId, List.of());
    }

    private Generation generate(UUID userId, String language, UUID requestId, List<String> legacyExcluded) {
        if (requestId == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "requestId is required");
        String lang = normalizeLanguage(language);
        OffsetDateTime requestedAt = store.now();
        var history = history(userId);
        if (history.size() < MIN_LOGS_REQUIRED) return new Generation(HttpStatus.OK, state(userId, lang));
        var selected = selectedProviders();
        if (selected.isEmpty()) throw unavailable();
        String providerKey = providerKey();
        var claim = store.claim(userId, requestId, lang, providerKey, requestedAt);
        if (claim == RecommendationAccountStore.Claim.REUSED) return new Generation(HttpStatus.OK, state(userId, lang));
        if (claim == RecommendationAccountStore.Claim.IN_PROGRESS) return new Generation(HttpStatus.ACCEPTED, state(userId, lang));
        if (claim == RecommendationAccountStore.Claim.LIMIT_REACHED) return new Generation(HttpStatus.TOO_MANY_REQUESTS, state(userId, lang));
        try {
            var first = candidateRound(userId, requestId, lang, history, selected, legacyExcluded, List.of(), CANDIDATE_POOL_SIZE, "primary");
            var gathered = new ArrayList<>(first.enriched());
            boolean refill = first.accepted().size() < TARGET_COUNT;
            boolean refillFailed = false;
            if (refill) {
                var considered = Stream.concat(first.received().stream(), first.enriched().stream()).toList();
                int missing = TARGET_COUNT - first.accepted().size();
                try {
                    var extra = candidateRound(userId, requestId, lang, history, selected, legacyExcluded,
                            considered, Math.min(CANDIDATE_POOL_SIZE, Math.max(TARGET_COUNT, missing * 2)), "refill");
                    gathered.addAll(extra.enriched());
                } catch (ResponseStatusException failure) {
                    // A useful first selection survives an optional refill outage.
                    refillFailed = true;
                    log.warn("[Recommendation] requestId={} stage=refill failed=true", requestId);
                }
            }
            // Re-read choices and records: another device may have changed them during either round.
            var items = eligible(userId, gathered, legacyExcluded).stream().limit(TARGET_COUNT).toList();
            if (refillFailed && items.isEmpty()) throw unavailable();
            // Completion and the quota increment commit together. A crash cannot leave a charged failed batch.
            store.complete(userId, requestId, lang, providerKey, items);
            var result = state(userId, lang, legacyExcluded);
            log.info("[Recommendation] requestId={} stage=complete target={} refill={} refillFailed={} selected={} returned={} partial={} quotaCharged=1",
                    requestId, TARGET_COUNT, refill, refillFailed, items.size(), result.items().size(), result.items().size() < TARGET_COUNT);
            return new Generation(HttpStatus.OK, result);
        } catch (Exception failure) {
            store.fail(userId, requestId);
            if (failure instanceof ResponseStatusException response) throw response;
            log.warn("Recommendation generation failed ({})", failure.getClass().getSimpleName());
            throw unavailable();
        }
    }

    /** Preserve the old array contract while enforcing the same durable account quota. */
    public List<RecommendationItem> getRecommendations(UUID userId, String language, List<String> excluded) {
        return getRecommendations(userId, language, excluded, false);
    }

    public List<RecommendationItem> getRecommendations(UUID userId, String language, List<String> excluded, boolean refresh) {
        String lang = normalizeLanguage(language);
        var view = state(userId, lang);
        if (refresh || (!view.hasBatch() && !view.generating() && view.eligible())) {
            var result = generate(userId, lang, UUID.randomUUID(), excluded == null ? List.of() : excluded.stream().filter(Objects::nonNull).toList());
            if (result.status() == HttpStatus.TOO_MANY_REQUESTS) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Daily recommendation limit reached");
            }
        }
        return state(userId, lang, excluded == null ? List.of() : excluded.stream().filter(Objects::nonNull).toList()).items();
    }

    private List<WatchLogEntity> history(UUID userId) {
        var history = logs.findTop50ForRecommendation(userId, store.now().minusMonths(3), PageRequest.of(0, 50));
        return history.size() >= MIN_LOGS_REQUIRED ? history : logs.findCompletedForRecommendation(userId, PageRequest.of(0, 50));
    }

    private List<LlmProvider> selectedProviders() {
        var enabled = providers.stream().filter(LlmProvider::isEnabled).toList();
        var preferred = enabled.stream().filter(LlmProvider::isPreferred).toList();
        return preferred.isEmpty() ? enabled : preferred;
    }

    private String providerKey() {
        return selectedProviders().stream().map(provider -> {
            String key = provider.cacheKey();
            return key == null ? provider.getClass().getSimpleName() : key;
        }).sorted().collect(Collectors.joining(","));
    }

    private record CandidateRound(List<RecommendationItem> received, List<RecommendationItem> enriched, List<RecommendationItem> accepted) {}

    private CandidateRound candidateRound(UUID userId, UUID requestId, String language, List<WatchLogEntity> history,
            List<LlmProvider> selected, List<String> legacyExcluded, List<RecommendationItem> considered, int requested, String stage) {
        var excluded = Stream.concat(Stream.concat(
                        namesForPrompt(store.exclusions(userId).stream().map(RecommendationAccountStore.Exclusion::item).toList()),
                        logs.findTitlesForRecommendationExclusion(userId).stream().map(title -> title.getName())),
                Stream.concat(legacyExcluded.stream(), namesForPrompt(considered)))
                .filter(Objects::nonNull).filter(name -> !name.isBlank()).distinct().toList();
        var received = callProviders(RecommendationPromptBuilder.candidatePool(history, language, excluded, requested), selected);
        var distinct = RecommendationTitleMatcher.filter(received, List.of(), List.of());
        var pool = distinct.stream().limit(CANDIDATE_POOL_SIZE).toList();
        var enriched = RecommendationTitleMatcher.filter(catalog.enrich(pool, language), List.of(), List.of());
        return store.readSnapshot(() -> {
            var afterRecords = RecommendationTitleMatcher.filter(enriched, logs.findTitlesForRecommendationExclusion(userId), List.of());
            var afterExcluded = RecommendationTitleMatcher.filter(afterRecords, List.of(), legacyExcluded,
                    store.exclusions(userId).stream().map(RecommendationAccountStore.Exclusion::item).toList());
            var accepted = RecommendationTitleMatcher.filter(afterExcluded, List.of(), List.of(), considered);
            log.info("[Recommendation] requestId={} stage={} requested={} received={} distinct={} catalogPool={} afterCatalog={} afterRecords={} afterExclusions={} newCandidates={}",
                    requestId, stage, requested, received.size(), distinct.size(), pool.size(), enriched.size(), afterRecords.size(), afterExcluded.size(), accepted.size());
            return new CandidateRound(received, enriched, accepted);
        });
    }

    private List<RecommendationItem> eligible(UUID userId, List<RecommendationItem> items, List<String> legacyExcluded) {
        return store.readSnapshot(() -> RecommendationTitleMatcher.filter(items, logs.findTitlesForRecommendationExclusion(userId), legacyExcluded,
                store.exclusions(userId).stream().map(RecommendationAccountStore.Exclusion::item).toList()));
    }

    private static Stream<String> namesForPrompt(List<RecommendationItem> items) {
        return items.stream().flatMap(item -> Stream.concat(Stream.of(item.name(), item.originalName()),
                item.alternateNames() == null ? Stream.empty() : item.alternateNames().stream()));
    }

    private List<RecommendationItem> callProviders(String prompt, List<LlmProvider> selected) {
        var futures = selected.stream().map(provider -> CompletableFuture.supplyAsync(() -> {
            try { return provider.recommend(prompt); }
            catch (Exception failure) {
                log.warn("Recommendation provider {} failed ({})", provider.getClass().getSimpleName(), failure.getClass().getSimpleName());
                return (List<RecommendationItem>) null;
            }
        }, EXECUTOR)).toList();
        var items = new ArrayList<RecommendationItem>();
        boolean succeeded = false;
        for (var future : futures) {
            var result = future.join();
            if (result != null) {
                succeeded = true;
                result.stream().filter(Objects::nonNull).limit(CANDIDATE_POOL_SIZE).forEach(items::add);
            }
        }
        if (!succeeded) throw unavailable();
        return List.copyOf(items);
    }

    public static String normalizeLanguage(String language) {
        if (language == null || language.isBlank()) return "ko";
        try {
            for (var range : Locale.LanguageRange.parse(language)) {
                if (range.getWeight() == 0) continue;
                if (range.getRange().startsWith("ko")) return "ko";
                if (range.getRange().startsWith("en")) return "en";
            }
        } catch (IllegalArgumentException ignored) { }
        return "en";
    }

    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Recommendations are temporarily unavailable");
    }
}
