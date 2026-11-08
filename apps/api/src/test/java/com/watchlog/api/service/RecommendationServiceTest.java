package com.watchlog.api.service;

import com.watchlog.api.domain.*;
import com.watchlog.api.dto.RecommendationState;
import com.watchlog.api.llm.*;
import com.watchlog.api.repo.WatchLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RecommendationServiceTest {
    private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-11-08T03:00:00Z");
    private final UUID userId = UUID.randomUUID();
    private final WatchLogRepository logs = mock(WatchLogRepository.class);
    private final RecommendationAccountStore store = mock(RecommendationAccountStore.class);
    private final LlmProvider provider = mock(LlmProvider.class);
    private final RecommendationCatalogService catalog = mock(RecommendationCatalogService.class);
    private final RecommendationService service = new RecommendationService(logs, store, List.of(provider), catalog);
    private final Map<String, RecommendationAccountStore.Batch> batches = new HashMap<>();
    private final AtomicInteger used = new AtomicInteger();

    @BeforeEach
    void setup() {
        when(store.readSnapshot(any())).thenAnswer(call -> ((java.util.function.Supplier<?>) call.getArgument(0)).get());
        when(provider.isEnabled()).thenReturn(true);
        when(provider.isPreferred()).thenReturn(true);
        when(provider.cacheKey()).thenReturn("openai:test");
        when(provider.recommend(anyString())).thenReturn(List.of(item("A New Story")));
        when(store.now()).thenReturn(NOW);
        when(store.isToday(any())).thenReturn(true);
        when(store.exclusions(userId)).thenReturn(List.of());
        when(store.batch(eq(userId), anyString())).thenAnswer(call -> Optional.ofNullable(batches.get(call.getArgument(1))));
        when(store.quota(userId)).thenAnswer(call -> new RecommendationState.Quota("2026-11-08", "Asia/Seoul", 3,
                used.get(), 3-used.get(), NOW.plusDays(1)));
        when(store.claim(eq(userId), any(), anyString(), anyString(), any())).thenReturn(RecommendationAccountStore.Claim.ACQUIRED);
        when(logs.countForRecommendation(userId)).thenReturn(5L);
        when(logs.findTitlesForRecommendationExclusion(userId)).thenReturn(List.of());
        when(logs.findTop50ForRecommendation(eq(userId), any(), any())).thenReturn(recent());
        when(catalog.enrich(anyList(), anyString())).thenAnswer(call -> call.getArgument(0));
        doAnswer(call -> {
            batches.put(call.getArgument(2), new RecommendationAccountStore.Batch(call.getArgument(1), call.getArgument(3), call.getArgument(4), NOW));
            used.incrementAndGet();
            return null;
        }).when(store).complete(eq(userId), any(), anyString(), anyString(), anyList());
    }

    @Test
    void stateIsReadOnlyAndCachedResultsRespectServerSideExclusions() {
        cached("ko", "Already Seen");
        when(store.exclusions(userId)).thenReturn(List.of(new RecommendationAccountStore.Exclusion("key", item("Already Seen"))));
        assertThat(service.state(userId, "ko").items()).isEmpty();
        assertThat(service.state(userId, "ko").quota().used()).isZero();
        verify(provider, never()).recommend(anyString());
        verify(store, never()).claim(any(), any(), anyString(), anyString(), any());
    }

    @Test
    void legacyArrayCacheStillRespectsCurrentExcludedNames() {
        cached("ko", "Ａｌｒｅａｄｙ—Ｓｅｅｎ");
        assertThat(service.getRecommendations(userId, "ko", List.of(" already seen "))).isEmpty();
        verify(provider, never()).recommend(anyString());
    }

    @Test
    void cachedResultsRespectHistoryOutsideThePromptWindow() {
        cached("ko", "An Older Favorite");
        when(logs.findTitlesForRecommendationExclusion(userId)).thenReturn(List.of(record("An Older Favorite").getTitle()));
        assertThat(service.state(userId, "ko").items()).isEmpty();
    }

    @Test
    void freshResultsDoNotRecommendAnOlderRecordedTitleAndPromptIncludesIt() {
        when(logs.findTitlesForRecommendationExclusion(userId)).thenReturn(List.of(record("An Older Favorite").getTitle()));
        when(provider.recommend(anyString())).thenReturn(List.of(item("An Older Favorite"), item("A New Story")));
        assertThat(service.generate(userId, "ko", UUID.randomUUID()).state().items()).extracting(RecommendationItem::name).containsExactly("A New Story");
        verify(provider, atLeastOnce()).recommend(contains("An Older Favorite"));
    }

    @Test
    void languageCachesRemainSeparateAndHeadersAreNormalized() {
        cached("en", "English Cached Result");
        assertThat(service.state(userId, "ko-KR").hasBatch()).isFalse();
        service.generate(userId, "ko-KR,ko;q=0.9", UUID.randomUUID());
        assertThat(service.state(userId, "en-US").items()).extracting(RecommendationItem::name).containsExactly("English Cached Result");
        assertThat(service.state(userId, "ko").items()).extracting(RecommendationItem::name).containsExactly("A New Story");
    }

    @Test
    void anOlderCompletedHistoryCanStillGenerateRecommendations() {
        when(logs.findTop50ForRecommendation(eq(userId), any(), any())).thenReturn(List.of());
        when(logs.findCompletedForRecommendation(eq(userId), any())).thenReturn(recent());
        assertThat(service.generate(userId, "ko", UUID.randomUUID()).state().items()).hasSize(1);
    }

    @Test
    void refreshFailureDoesNotReplaceTheSuccessfulBatchOrConsumeQuota() {
        cached("ko", "A Kept Story");
        UUID request = UUID.randomUUID();
        when(provider.recommend(anyString())).thenThrow(new IllegalStateException("sensitive upstream body"));
        assertThatThrownBy(() -> service.generate(userId, "ko", request)).isInstanceOf(ResponseStatusException.class).hasMessageNotContaining("sensitive");
        verify(store).fail(userId, request);
        verify(store, never()).complete(any(), any(), anyString(), anyString(), anyList());
        assertThat(service.state(userId, "ko").items()).extracting(RecommendationItem::name).containsExactly("A Kept Story");
        assertThat(service.state(userId, "ko").quota().used()).isZero();
    }

    @Test
    void aConfiguredPreferredProviderReplacesTheLegacyProviders() {
        var legacy = mock(LlmProvider.class);
        when(legacy.isEnabled()).thenReturn(true);
        var preferred = new RecommendationService(logs, store, List.of(legacy, provider), catalog);
        assertThat(preferred.generate(userId, "ko", UUID.randomUUID()).state().items()).hasSize(1);
        verify(legacy, never()).recommend(anyString());
    }

    @Test
    void aValidEmptyBatchIsRecordedSoInitialLoadingDoesNotLoop() {
        when(provider.recommend(anyString())).thenReturn(List.of());
        var state = service.generate(userId, "ko", UUID.randomUUID()).state();
        assertThat(state.items()).isEmpty();
        assertThat(state.hasBatch()).isTrue();
        assertThat(state.quota().used()).isEqualTo(1);
    }

    @Test
    void aServerLimitOrConcurrentLeaseNeverCallsTheModelAgain() {
        when(store.claim(eq(userId), any(), anyString(), anyString(), any())).thenReturn(RecommendationAccountStore.Claim.LIMIT_REACHED);
        used.set(3);
        var exhausted = service.generate(userId, "ko", UUID.randomUUID());
        assertThat(exhausted.status()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(exhausted.state().quota().remaining()).isZero();
        when(store.claim(eq(userId), any(), anyString(), anyString(), any())).thenReturn(RecommendationAccountStore.Claim.IN_PROGRESS);
        assertThat(service.generate(userId, "ko", UUID.randomUUID()).status()).isEqualTo(HttpStatus.ACCEPTED);
        verify(provider, never()).recommend(anyString());
    }

    @Test
    void aReplayOfACompletedRequestIsFree() {
        cached("ko", "A Kept Story");
        when(store.claim(eq(userId), any(), anyString(), anyString(), any())).thenReturn(RecommendationAccountStore.Claim.REUSED);
        assertThat(service.generate(userId, "ko", UUID.randomUUID()).state().items()).hasSize(1);
        verify(provider, never()).recommend(anyString());
        verify(store, never()).complete(any(), any(), anyString(), anyString(), anyList());
    }

    @Test
    void directAndOutboxWritesKeepTheBatchButNewlyRecordedWorksDisappearImmediately() {
        cached("ko", "A Kept Story");
        when(logs.findTitlesForRecommendationExclusion(userId)).thenReturn(List.of(record("A Kept Story").getTitle()));
        var state = service.state(userId, "ko");
        assertThat(state.items()).isEmpty();
        assertThat(state.hasBatch()).isTrue();
        verify(provider, never()).recommend(anyString());
    }

    @Test
    void insufficientCompletedRecordsDoNotStartOrChargeGeneration() {
        when(logs.countForRecommendation(userId)).thenReturn(2L);
        when(logs.findTop50ForRecommendation(eq(userId), any(), any())).thenReturn(List.of());
        when(logs.findCompletedForRecommendation(eq(userId), any())).thenReturn(List.of());
        var state = service.generate(userId, "ko", UUID.randomUUID()).state();
        assertThat(state.eligible()).isFalse();
        assertThat(state.quota().used()).isZero();
        verify(store, never()).claim(any(), any(), anyString(), anyString(), any());
    }

    @Test
    void languageHeadersAreReducedToTheSupportedLanguageByPreference() {
        assertThat(RecommendationService.normalizeLanguage("en-US,en;q=0.9,ko;q=0.8")).isEqualTo("en");
        assertThat(RecommendationService.normalizeLanguage("ko-KR,ko;q=0.9,en;q=0.8")).isEqualTo("ko");
        assertThat(RecommendationService.normalizeLanguage("ko;q=0,en;q=1")).isEqualTo("en");
    }

    @Test
    void quantityRefillsAfterRecordedAndDismissedCandidatesAreRemovedAndChargesOnce() {
        when(logs.findTitlesForRecommendationExclusion(userId)).thenReturn(List.of(record("An Older Favorite").getTitle()));
        when(store.exclusions(userId)).thenReturn(List.of(new RecommendationAccountStore.Exclusion("hidden", item("Dismissed Story"))));
        when(provider.recommend(anyString())).thenReturn(
                List.of(item("Dismissed Story"), item("An Older Favorite"), item("Keep 1"), item("Keep 2")),
                List.of(item("Keep 3"), item("Keep 4"), item("Keep 5"), item("Keep 6")));
        var result = service.generate(userId, "ko", UUID.randomUUID()).state();
        assertThat(result.items()).extracting(RecommendationItem::name).containsExactly("Keep 1", "Keep 2", "Keep 3", "Keep 4", "Keep 5", "Keep 6");
        assertThat(result.quota().used()).isEqualTo(1);
        verify(provider, times(2)).recommend(anyString());
        verify(store, times(1)).complete(eq(userId), any(), eq("ko"), anyString(), anyList());
    }

    @Test
    void quantityUsesASurplusPoolButReturnsSixWithoutAnotherModelCallWhenEnoughSurvive() {
        when(provider.recommend(anyString())).thenReturn(java.util.stream.IntStream.rangeClosed(1, 12).mapToObj(i -> item("Keep " + i)).toList());
        assertThat(service.generate(userId, "ko", UUID.randomUUID()).state().items()).hasSize(6);
        verify(provider, times(1)).recommend(anyString());
    }

    @Test
    void quantityStopsAfterOneRefillEvenIfTheModelRepeatsAllCandidates() {
        when(provider.recommend(anyString())).thenReturn(List.of(item("Keep 1"), item("Keep 2")));
        var result = service.generate(userId, "ko", UUID.randomUUID()).state();
        assertThat(result.items()).hasSize(2);
        assertThat(result.quota().used()).isEqualTo(1);
        verify(provider, times(2)).recommend(anyString());
    }

    @Test
    void quantityRetainsUsefulPartialResultsWhenTheRefillFails() {
        when(provider.recommend(anyString())).thenReturn(List.of(item("Keep 1"), item("Keep 2")))
                .thenThrow(new IllegalStateException("synthetic refill outage"));
        var result = service.generate(userId, "ko", UUID.randomUUID()).state();
        assertThat(result.items()).hasSize(2);
        assertThat(result.quota().used()).isEqualTo(1);
        verify(provider, times(2)).recommend(anyString());
    }

    @Test
    void quantityKeepsTheOldBatchAndQuotaWhenNoCandidateSurvivesAndRefillFails() {
        cached("ko", "A Kept Story");
        when(logs.findTitlesForRecommendationExclusion(userId)).thenReturn(List.of(record("An Older Favorite").getTitle()));
        when(provider.recommend(anyString())).thenReturn(List.of(item("An Older Favorite")))
                .thenThrow(new IllegalStateException("synthetic refill outage"));
        assertThatThrownBy(() -> service.generate(userId, "ko", UUID.randomUUID())).isInstanceOf(ResponseStatusException.class);
        assertThat(service.state(userId, "ko").items()).extracting(RecommendationItem::name).containsExactly("A Kept Story");
        assertThat(used.get()).isZero();
        verify(store, never()).complete(any(), any(), anyString(), anyString(), anyList());
    }

    @Test
    void quantityRechecksChoicesAndRecordsChangedDuringRefillBeforeSelectingSix() {
        var calls = new AtomicInteger();
        when(provider.recommend(anyString())).thenAnswer(call -> {
            if (calls.incrementAndGet() == 1) return List.of(item("Keep 1"), item("Keep 2"), item("Keep 3"), item("Keep 4"));
            when(store.exclusions(userId)).thenReturn(List.of(new RecommendationAccountStore.Exclusion("hidden", item("Keep 1"))));
            when(logs.findTitlesForRecommendationExclusion(userId)).thenReturn(List.of(record("Keep 2").getTitle()));
            return List.of(item("Keep 5"), item("Keep 6"), item("Keep 7"), item("Keep 8"));
        });
        assertThat(service.generate(userId, "ko", UUID.randomUUID()).state().items()).extracting(RecommendationItem::name)
                .containsExactly("Keep 3", "Keep 4", "Keep 5", "Keep 6", "Keep 7", "Keep 8");
    }

    @Test
    void quantityHonorsLegacyRequestExclusionsWhenRefilling() {
        when(provider.recommend(anyString())).thenReturn(
                List.of(item("Legacy Hidden"), item("Keep 1"), item("Keep 2"), item("Keep 3"), item("Keep 4"), item("Keep 5")),
                List.of(item("Keep 6"), item("Keep 7")));
        assertThat(service.getRecommendations(userId, "ko", List.of("Legacy Hidden"), true))
                .extracting(RecommendationItem::name).containsExactly("Keep 1", "Keep 2", "Keep 3", "Keep 4", "Keep 5", "Keep 6");
    }

    @Test
    void quantityLogsEachCountWithoutLoggingPrivateNotesOrTitles() {
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(RecommendationService.class);
        var capture = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        capture.start();
        logger.addAppender(capture);
        try {
            when(logs.findTitlesForRecommendationExclusion(userId)).thenReturn(List.of(record("Private Recorded Title").getTitle()));
            when(store.exclusions(userId)).thenReturn(List.of(new RecommendationAccountStore.Exclusion("hidden", item("Private Dismissed Title"))));
            when(provider.recommend(anyString())).thenReturn(
                    List.of(item("Private Recorded Title"), item("Private Dismissed Title"), item("Keep 1"), item("Keep 2")),
                    List.of(item("Keep 3"), item("Keep 4"), item("Keep 5"), item("Keep 6")));
            service.generate(userId, "ko", UUID.randomUUID());
            var messages = capture.list.stream().map(ch.qos.logback.classic.spi.ILoggingEvent::getFormattedMessage).toList();
            assertThat(messages).anySatisfy(message -> assertThat(message).contains("stage=primary", "received=4", "afterRecords=3", "afterExclusions=2"));
            assertThat(messages).anySatisfy(message -> assertThat(message).contains("stage=refill", "received=4", "newCandidates=4"));
            assertThat(messages).anySatisfy(message -> assertThat(message).contains("stage=complete", "selected=6", "returned=6", "quotaCharged=1"));
            assertThat(String.join("\n", messages)).doesNotContain("Private Recorded Title", "Private Dismissed Title", "Keep 1");
        } finally {
            logger.detachAppender(capture);
            capture.stop();
        }
    }

    private void cached(String language, String name) {
        batches.put(language, new RecommendationAccountStore.Batch(UUID.randomUUID(), "openai:test", List.of(item(name)), NOW));
    }
    private static List<WatchLogEntity> recent() { return List.of(record("One"), record("Two"), record("Three"), record("Four"), record("Five")); }
    private static WatchLogEntity record(String name) { return new WatchLogEntity(UUID.randomUUID(), new TitleEntity(UUID.randomUUID(), TitleType.movie, name), Status.DONE); }
    private static RecommendationItem item(String name) { return new RecommendationItem(name, "movie", "A remembered theme", List.of(), null); }
}
