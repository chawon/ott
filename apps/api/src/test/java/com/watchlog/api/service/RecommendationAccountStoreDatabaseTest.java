package com.watchlog.api.service;

import com.watchlog.api.llm.RecommendationItem;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.*;
import static com.watchlog.api.service.RecommendationAccountStore.Claim.*;

/** Opt-in local PostgreSQL checks use an isolated temporary schema, never existing account tables. */
@EnabledIfEnvironmentVariable(named = "OTTLINE_RECOMMENDATION_DB_TEST", matches = "1")
class RecommendationAccountStoreDatabaseTest {
    private final UUID user = UUID.randomUUID();
    private final MutableClock clock = new MutableClock(Instant.parse("2026-11-08T03:00:00Z"));
    private JdbcTemplate admin;
    private JdbcTemplate jdbc;
    private DriverManagerDataSource source;
    private RecommendationAccountStore store;
    private String schema;

    @BeforeEach
    void setup() throws Exception {
        String url = System.getenv().getOrDefault("OTTLINE_TEST_DATABASE_URL", "jdbc:postgresql://127.0.0.1:5433/watchlog");
        assertThat(url).containsAnyOf("127.0.0.1", "localhost");
        String username = System.getenv().getOrDefault("OTTLINE_TEST_DATABASE_USER", "watchlog");
        String password = System.getenv().getOrDefault("OTTLINE_TEST_DATABASE_PASSWORD", "watchlog");
        admin = new JdbcTemplate(new DriverManagerDataSource(url, username, password));
        schema = "recommendation_qa_" + UUID.randomUUID().toString().replace("-", "");
        admin.execute("create schema " + schema);
        source = new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema, username, password);
        jdbc = new JdbcTemplate(source);
        jdbc.execute("create table users(id uuid primary key)");
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration/V32__recommendation_account_state.sql")));
        jdbc.update("insert into users(id) values(?)", user);
        store = new RecommendationAccountStore(jdbc, new DataSourceTransactionManager(source), clock);
    }

    @AfterEach
    void cleanup() {
        if (admin != null && schema != null) admin.execute("drop schema " + schema + " cascade");
    }

    @Test
    void readOnlyQuotaDoesNotCreateOrChargeAnAccount() {
        assertThat(store.quota(user).remaining()).isEqualTo(3);
        assertThat(store.generating(user)).isFalse();
        assertThat(jdbc.queryForObject("select count(*) from recommendation_account_state", Integer.class)).isZero();
    }

    @Test
    void threeSuccessesAreDurableAcrossProcessesAndCachedReadsAreFree() {
        var ids = new ArrayList<UUID>();
        for (int count = 1; count <= 3; count++) {
            ids.add(generate(user, "ko"));
            assertThat(store.quota(user).used()).isEqualTo(count);
            assertThat(store.batch(user, "ko")).isPresent();
        }
        var restarted = new RecommendationAccountStore(jdbc, new DataSourceTransactionManager(source), clock);
        assertThat(restarted.quota(user).remaining()).isZero();
        assertThat(restarted.claim(user, UUID.randomUUID(), "en", "openai:test", store.now())).isEqualTo(LIMIT_REACHED);
        assertThat(restarted.claim(user, ids.getFirst(), "ko", "openai:test", store.now())).isEqualTo(REUSED);
        assertThat(restarted.quota(user).used()).isEqualTo(3);
    }

    @Test
    void aFailedAttemptCanRetryTheSameRequestWithoutConsumingQuota() {
        var request = UUID.randomUUID();
        assertThat(store.claim(user, request, "ko", "openai:test", store.now())).isEqualTo(ACQUIRED);
        store.fail(user, request);
        assertThat(store.quota(user).used()).isZero();
        assertThat(store.claim(user, request, "ko", "openai:test", store.now())).isEqualTo(ACQUIRED);
        store.complete(user, request, "ko", "openai:test", List.of(item("A story", "movie", "1")));
        assertThat(store.quota(user).used()).isEqualTo(1);
    }

    @Test
    void aStateReadCannotCombineAnOldBatchWithANewQuotaDuringCompletion() throws Exception {
        UUID request = UUID.randomUUID();
        store.claim(user, request, "ko", "openai:test", store.now());
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            store.readSnapshot(() -> {
                assertThat(store.batch(user, "ko")).isEmpty();
                try {
                    executor.submit(() -> store.complete(user, request, "ko", "openai:test", List.of())).get(5, TimeUnit.SECONDS);
                } catch (Exception error) { throw new AssertionError(error); }
                assertThat(store.quota(user).used()).isZero();
                assertThat(store.generating(user)).isTrue();
                return null;
            });
        }
        assertThat(store.quota(user).used()).isEqualTo(1);
        assertThat(store.batch(user, "ko")).isPresent();
    }

    @Test
    void concurrentDevicesAcquireExactlyOneGenerationAndShareItsResult() throws Exception {
        var start = new CountDownLatch(1);
        var attemptedAt = store.now();
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var requests = java.util.stream.IntStream.range(0, 12).mapToObj(i -> UUID.randomUUID()).toList();
            var futures = requests.stream().map(request -> executor.submit(() -> {
                start.await();
                return store.claim(user, request, "ko", "openai:test", attemptedAt);
            })).toList();
            start.countDown();
            var claims = new ArrayList<RecommendationAccountStore.Claim>();
            for (var future : futures) claims.add(future.get(15, TimeUnit.SECONDS));
            assertThat(claims).filteredOn(ACQUIRED::equals).hasSize(1);
            assertThat(claims).filteredOn(IN_PROGRESS::equals).hasSize(11);
            var owner = requests.get(claims.indexOf(ACQUIRED));
            clock.advance(Duration.ofSeconds(1));
            store.complete(user, owner, "ko", "openai:test", List.of(item("A story", "movie", "1")));
            assertThat(store.claim(user, UUID.randomUUID(), "ko", "openai:test", attemptedAt)).isEqualTo(REUSED);
            clock.advance(Duration.ofSeconds(2));
            var restarted = new RecommendationAccountStore(jdbc, new DataSourceTransactionManager(source), clock);
            for (var request : requests) {
                assertThat(restarted.claim(user, request, "ko", "openai:test", store.now())).isEqualTo(REUSED);
            }
            assertThat(store.quota(user).used()).isEqualTo(1);
        }
    }

    @Test
    void aDifferentLanguageJoinedRequestCanRetryWithoutReplayingAnotherLanguagesCompletion() {
        UUID korean = UUID.randomUUID(), english = UUID.randomUUID();
        assertThat(store.claim(user, korean, "ko", "openai:test", store.now())).isEqualTo(ACQUIRED);
        assertThat(store.claim(user, english, "en", "openai:test", store.now())).isEqualTo(IN_PROGRESS);
        store.complete(user, korean, "ko", "openai:test", List.of());
        clock.advance(Duration.ofSeconds(1));
        assertThat(store.claim(user, english, "en", "openai:test", store.now())).isEqualTo(ACQUIRED);
        store.complete(user, english, "en", "openai:test", List.of());
        assertThat(store.quota(user).used()).isEqualTo(2);
        assertThatThrownBy(() -> store.claim(user, korean, "en", "openai:test", store.now())).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void koreanMidnightResetsTheSharedQuota() {
        clock.set(Instant.parse("2026-11-08T14:59:50Z"));
        generate(user, "ko");
        generate(user, "en");
        assertThat(store.quota(user).date()).isEqualTo("2026-11-08");
        assertThat(store.quota(user).used()).isEqualTo(2);
        clock.set(Instant.parse("2026-11-08T15:00:01Z"));
        assertThat(store.quota(user).date()).isEqualTo("2026-11-09");
        assertThat(store.quota(user).used()).isZero();
        generate(user, "ko");
        assertThat(store.quota(user).used()).isEqualTo(1);
    }

    @Test
    void expiredLeasesRecoverAfterRestartAndRejectLateResults() {
        var old = UUID.randomUUID();
        store.claim(user, old, "ko", "openai:test", store.now());
        clock.advance(Duration.ofMinutes(3));
        var current = UUID.randomUUID();
        assertThat(store.claim(user, current, "ko", "openai:test", store.now())).isEqualTo(ACQUIRED);
        assertThatThrownBy(() -> store.complete(user, old, "ko", "openai:test", List.of())).isInstanceOf(ResponseStatusException.class);
        store.complete(user, current, "ko", "openai:test", List.of());
        assertThat(store.quota(user).used()).isEqualTo(1);
        assertThat(store.batch(user, "ko").orElseThrow().items()).isEmpty();
    }

    @Test
    void typedExclusionsAreIdempotentCrossDeviceAndUndoIsIdempotent() {
        var first = store.putExclusion(user, item("A story", "movie", "10"));
        assertThat(store.putExclusion(user, item("다른 언어의 제목", "movie", "10")).key()).isEqualTo(first.key());
        store.putExclusion(user, item("A story", "series", "10"));
        var otherProcess = new RecommendationAccountStore(jdbc, new DataSourceTransactionManager(source), clock);
        assertThat(otherProcess.exclusions(user)).hasSize(2);
        otherProcess.removeExclusion(user, first.key());
        otherProcess.removeExclusion(user, first.key());
        assertThat(store.exclusions(user)).singleElement().satisfies(entry -> assertThat(entry.item().type()).isEqualTo("series"));
        assertThat(store.quota(user).used()).isZero();
    }

    @Test
    void mergingAccountsUnionsChoicesAndCannotResetTheDailyAllowanceThenDeletionCascades() {
        UUID target = UUID.randomUUID();
        jdbc.update("insert into users(id) values(?)", target);
        generate(user, "ko");
        generate(user, "en");
        generate(target, "ko");
        store.putExclusion(user, item("A movie", "movie", "1"));
        store.putExclusion(target, item("A series", "series", "1"));
        store.merge(user, target);
        jdbc.update("delete from users where id=?", user);
        assertThat(store.quota(target).used()).isEqualTo(3);
        assertThat(store.exclusions(target)).hasSize(2);
        assertThat(store.claim(target, UUID.randomUUID(), "ko", "openai:test", store.now())).isEqualTo(LIMIT_REACHED);
        jdbc.update("delete from users where id=?", target);
        for (String table : List.of("recommendation_account_state", "recommendation_exclusions", "recommendation_generation_attempts", "recommendation_batches")) {
            assertThat(jdbc.queryForObject("select count(*) from " + table, Integer.class)).isZero();
        }
    }

    @Test
    void failedBatchReplacementRollsBackBothTheQuotaAndThePreviousBatch() {
        generate(user, "ko");
        var previous = store.batch(user, "ko").orElseThrow();
        jdbc.execute("create function reject_batch() returns trigger language plpgsql as $$ begin raise exception 'synthetic write failure'; end $$");
        jdbc.execute("create trigger reject_batch before update on recommendation_batches for each row execute function reject_batch()");
        var request = UUID.randomUUID();
        clock.advance(Duration.ofSeconds(1));
        assertThat(store.claim(user, request, "ko", "openai:test", store.now())).isEqualTo(ACQUIRED);
        assertThatThrownBy(() -> store.complete(user, request, "ko", "openai:test", List.of())).isInstanceOf(org.springframework.dao.DataAccessException.class);
        store.fail(user, request);
        assertThat(store.quota(user).used()).isEqualTo(1);
        assertThat(store.batch(user, "ko").orElseThrow().generationId()).isEqualTo(previous.generationId());
        assertThat(store.generating(user)).isFalse();
    }

    @Test
    void primaryAndRefillModelCallsCommitExactlyOneDurableGeneration() {
        var logs = org.mockito.Mockito.mock(com.watchlog.api.repo.WatchLogRepository.class);
        var provider = org.mockito.Mockito.mock(com.watchlog.api.llm.LlmProvider.class);
        var catalog = org.mockito.Mockito.mock(RecommendationCatalogService.class);
        var history = java.util.stream.IntStream.rangeClosed(1, 5).mapToObj(i -> new com.watchlog.api.domain.WatchLogEntity(
                UUID.randomUUID(), new com.watchlog.api.domain.TitleEntity(UUID.randomUUID(), com.watchlog.api.domain.TitleType.movie, "History " + i),
                com.watchlog.api.domain.Status.DONE)).toList();
        org.mockito.Mockito.when(logs.countForRecommendation(user)).thenReturn(5L);
        org.mockito.Mockito.when(logs.findTop50ForRecommendation(org.mockito.ArgumentMatchers.eq(user), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any())).thenReturn(history);
        org.mockito.Mockito.when(logs.findTitlesForRecommendationExclusion(user)).thenReturn(List.of(new com.watchlog.api.domain.TitleEntity(
                UUID.randomUUID(), com.watchlog.api.domain.TitleType.movie, "Recorded")));
        org.mockito.Mockito.when(provider.isEnabled()).thenReturn(true);
        org.mockito.Mockito.when(provider.cacheKey()).thenReturn("openai:fixture");
        var calls = new java.util.concurrent.atomic.AtomicInteger();
        org.mockito.Mockito.when(provider.recommend(org.mockito.ArgumentMatchers.anyString())).thenAnswer(call -> {
            assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return calls.incrementAndGet() == 1
                    ? List.of(item("Recorded", "movie", "800"), item("Dismissed", "movie", "900"), item("Keep 1", "movie", "1"), item("Keep 2", "movie", "2"))
                    : List.of(item("Keep 3", "movie", "3"), item("Keep 4", "movie", "4"), item("Keep 5", "movie", "5"), item("Keep 6", "movie", "6"));
        });
        org.mockito.Mockito.when(catalog.enrich(org.mockito.ArgumentMatchers.anyList(), org.mockito.ArgumentMatchers.anyString()))
                .thenAnswer(call -> call.getArgument(0));
        store.putExclusion(user, item("Dismissed", "movie", "900"));
        var service = new RecommendationService(logs, store, List.of(provider), catalog);
        UUID request = UUID.randomUUID();
        var result = service.generate(user, "ko", request).state();
        assertThat(result.items()).hasSize(6);
        assertThat(calls.get()).isEqualTo(2);
        assertThat(store.quota(user).used()).isEqualTo(1);
        assertThat(store.batch(user, "ko").orElseThrow().items()).hasSize(6);
        assertThat(jdbc.queryForObject("select count(*) from recommendation_generation_attempts where user_id=? and status='COMPLETED'", Integer.class, user)).isEqualTo(1);
        assertThat(service.generate(user, "ko", request).state().items()).hasSize(6);
        assertThat(calls.get()).isEqualTo(2);
        assertThat(store.quota(user).used()).isEqualTo(1);
    }

    private UUID generate(UUID userId, String language) {
        clock.advance(Duration.ofSeconds(1));
        UUID request = UUID.randomUUID();
        assertThat(store.claim(userId, request, language, "openai:test", store.now())).isEqualTo(ACQUIRED);
        clock.advance(Duration.ofSeconds(1));
        store.complete(userId, request, language, "openai:test", List.of(item("A story", "movie", "1")));
        return request;
    }

    private static RecommendationItem item(String name, String type, String id) {
        return new RecommendationItem(name, type, "A remembered theme", List.of(), null, "TMDB", id, 2020, List.of());
    }

    private static final class MutableClock extends Clock {
        private final AtomicReference<Instant> instant;
        MutableClock(Instant instant) { this.instant = new AtomicReference<>(instant); }
        void advance(Duration duration) { instant.updateAndGet(value -> value.plus(duration)); }
        void set(Instant value) { instant.set(value); }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return instant.get(); }
    }
}
