package com.watchlog.api.service;

import com.watchlog.api.notify.CuratorAutomationProperties;
import com.watchlog.api.notify.CuratorTelegramClient;
import com.watchlog.api.notify.TelegramProperties;
import com.watchlog.api.tmdb.TmdbClient;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CuratorAutomationServiceTest {
    private static PostgreSQLContainer postgres;
    private static DriverManagerDataSource dataSource;
    private static JdbcTemplate jdbc;
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final TelegramProperties TELEGRAM = new TelegramProperties(true, "test-token", "123", "http://localhost", "ottline");
    private static final CuratorAutomationProperties CONFIG = new CuratorAutomationProperties(true, "456", "ko", 2, 4);
    private static final LocalDate DAY = LocalDate.of(2026, 9, 6);
    private FakeTelegram telegram;
    private TmdbClient tmdb;
    private CuratorAutomationService service;

    @BeforeAll
    static void database() {
        String url = System.getenv("CURATOR_TEST_JDBC_URL");
        if (url == null) {
            assumeTrue(DockerClientFactory.instance().isDockerAvailable(), "PostgreSQL test requires Docker or CURATOR_TEST_JDBC_URL");
            postgres = new PostgreSQLContainer("postgres:16-alpine");
            postgres.start();
            dataSource = new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
        } else {
            // Must point to a disposable database: fixtures and migrations are intentionally destructive there.
            dataSource = new DriverManagerDataSource(url, System.getenv().getOrDefault("CURATOR_TEST_DB_USER", "ergate23"), "");
        }
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();
        jdbc = new JdbcTemplate(dataSource);
    }

    @AfterAll
    static void stop() { if (postgres != null) postgres.stop(); }

    @BeforeEach
    void setup() {
        jdbc.update("delete from curated_telegram_actions");
        jdbc.update("delete from curated_telegram_reviews");
        jdbc.update("delete from curated_contents");
        jdbc.update("delete from titles");
        jdbc.update("update curated_telegram_state set next_update_id=0");
        telegram = new FakeTelegram();
        tmdb = mock(TmdbClient.class);
        var items = new ArrayList<TmdbClient.SearchItem>();
        for (int i = 1; i <= 10; i++) {
            items.add(JSON.readValue("{\"id\":" + i + ",\"media_type\":\"movie\",\"title\":\"작품 " + i + "\",\"poster_path\":\"/poster.jpg\"}", TmdbClient.SearchItem.class));
        }
        when(tmdb.availablePopular("ko-KR", 40)).thenReturn(items);
        service = newService(CONFIG);
    }

    private CuratorAutomationService newService(CuratorAutomationProperties config) {
        return new CuratorAutomationService(jdbc, new DataSourceTransactionManager(dataSource),
                new CuratedContentAdminService(jdbc, JSON, "admin-token"), new CuratedPromptGenerator(), tmdb,
                telegram, TELEGRAM, config, "admin-token");
    }

    @Test
    void dailyLimitPendingLimitAndRestartDoNotDuplicateDrafts() {
        service.generateForDate(DAY);
        newService(CONFIG).generateForDate(DAY);
        assertThat(count("curated_contents")).isEqualTo(2);
        service.generateForDate(DAY.plusDays(1));
        service.generateForDate(DAY.plusDays(2));
        assertThat(count("curated_contents")).isEqualTo(4);
        assertThat(jdbc.queryForObject("select count(*) from curated_contents where status='PUBLISHED'", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(distinct title_id) from curated_contents", Integer.class)).isEqualTo(4);
    }

    @Test
    void concurrentReplicasRespectTheDailyLimit() throws Exception {
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> { start.await(); service.generateForDate(DAY); return true; });
            var second = executor.submit(() -> { start.await(); newService(CONFIG).generateForDate(DAY); return true; });
            start.countDown();
            first.get(15, java.util.concurrent.TimeUnit.SECONDS);
            second.get(15, java.util.concurrent.TimeUnit.SECONDS);
        }
        assertThat(count("curated_contents")).isEqualTo(2);
    }

    @Test
    void disabledModeDoesNotGeneratePollOrSend() {
        var disabled = newService(new CuratorAutomationProperties(false, "", "ko", 2, 4));
        disabled.generateForDate(DAY);
        disabled.pollScheduled();
        assertThat(count("curated_contents")).isZero();
        assertThat(telegram.methods).isEmpty();
    }

    @Test
    void configuredWebhookPreventsUnactionableDrafts() {
        telegram.webhook = "https://example.invalid/hook";
        assertThatThrownBy(() -> service.generateForDate(DAY)).hasMessageContaining("webhook");
        assertThat(count("curated_contents")).isZero();
    }

    @Test
    void approvalPublishesOnceAndUpdatesMessageWithNoButtons() {
        UUID id = prepare();
        telegram.update(10, id, "p", 0, 456, 123, messageId(id));
        service.pollScheduled();
        newService(CONFIG).pollScheduled();
        assertThat(status(id)).isEqualTo("PUBLISHED");
        assertThat(count("curated_telegram_actions")).isEqualTo(1);
        assertThat(jdbc.queryForObject("select next_update_id from curated_telegram_state", Long.class)).isEqualTo(11);
        assertThat(telegram.lastEdited.get("text").toString()).contains("게시 완료");
        assertThat(telegram.lastEdited.get("reply_markup")).isEqualTo(Map.of("inline_keyboard", List.of()));
    }

    @Test
    void successAcknowledgementWaitsForCommitAndIsSuppressedOnRollback() {
        UUID id = prepare();
        telegram.update(1, id, "p", 0, 456, 123, messageId(id));
        var outer = new org.springframework.transaction.support.TransactionTemplate(new DataSourceTransactionManager(dataSource));
        outer.executeWithoutResult(transaction -> {
            service.pollScheduled();
            assertThat(telegram.methods).doesNotContain("answerCallbackQuery");
            transaction.setRollbackOnly();
        });
        assertThat(status(id)).isEqualTo("DRAFT");
        assertThat(telegram.methods).doesNotContain("answerCallbackQuery");
        service.pollScheduled();
        assertThat(status(id)).isEqualTo("PUBLISHED");
        assertThat(telegram.methods).contains("answerCallbackQuery");
    }

    @Test
    void differentUserChatMessageAndMalformedDataCannotPublish() {
        UUID id = prepare();
        telegram.update(1, id, "p", 0, 999, 123, messageId(id));
        telegram.update(2, id, "p", 0, 456, 999, messageId(id));
        telegram.update(3, id, "p", 0, 456, 123, messageId(id) + 10);
        telegram.update(4, id, "invalid", 0, 456, 123, messageId(id));
        service.pollScheduled();
        assertThat(status(id)).isEqualTo("DRAFT");
        assertThat(count("curated_telegram_actions")).isZero();
    }

    @Test
    void regenerationInvalidatesOldButtonsEvenWithinSameUpdateBatch() {
        UUID id = prepare();
        String before = body(id);
        telegram.update(1, id, "r", 0, 456, 123, messageId(id));
        telegram.update(2, id, "p", 0, 456, 123, messageId(id));
        telegram.update(3, id, "r", 0, 456, 123, messageId(id));
        service.pollScheduled();
        assertThat(status(id)).isEqualTo("DRAFT");
        assertThat(body(id)).isNotEqualTo(before);
        assertThat(count("curated_telegram_actions")).isEqualTo(1);
        telegram.update(4, id, "p", 1, 456, 123, messageId(id));
        service.pollScheduled();
        assertThat(status(id)).isEqualTo("PUBLISHED");
        assertThat(jdbc.queryForObject("select body from curated_telegram_actions where update_id=4", String.class)).isEqualTo(body(id));
    }

    @Test
    void skipRemovesDraftAndNeverUnpublishesWithOldSkipButton() {
        UUID id = prepare();
        telegram.update(1, id, "s", 0, 456, 123, messageId(id));
        service.pollScheduled();
        assertThat(status(id)).isEqualTo("DISABLED");
        telegram.update(2, id, "p", 0, 456, 123, messageId(id));
        service.pollScheduled();
        assertThat(status(id)).isEqualTo("DISABLED");
        UUID other = jdbc.queryForObject("select id from curated_contents where id<>?", UUID.class, id);
        telegram.update(3, other, "p", 0, 456, 123, messageId(other));
        telegram.update(4, other, "s", 0, 456, 123, messageId(other));
        service.pollScheduled();
        assertThat(status(other)).isEqualTo("PUBLISHED");
    }

    @Test
    void failedDeliveryRetriesWithoutCreatingAnotherDraft() {
        service.generateForDate(DAY);
        telegram.failDelivery = true;
        service.pollScheduled();
        assertThat(jdbc.queryForObject("select count(*) from curated_telegram_reviews where message_id is not null", Integer.class)).isZero();
        telegram.failDelivery = false;
        jdbc.update("update curated_telegram_reviews set next_delivery_at=now()");
        service.pollScheduled();
        assertThat(count("curated_contents")).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from curated_telegram_reviews where message_id is not null", Integer.class)).isEqualTo(2);
    }

    @Test
    void messageEditFailureDoesNotRollBackPublicationAndRetries() {
        UUID id = prepare();
        telegram.failDelivery = true;
        telegram.update(1, id, "p", 0, 456, 123, messageId(id));
        service.pollScheduled();
        assertThat(status(id)).isEqualTo("PUBLISHED");
        telegram.failDelivery = false;
        jdbc.update("update curated_telegram_reviews set next_delivery_at=now()");
        service.pollScheduled();
        assertThat(telegram.lastEdited.get("text").toString()).contains("게시 완료");
        assertThat(count("curated_telegram_actions")).isEqualTo(1);
    }

    @Test
    void externalBodyChangeRequiresANewReview() {
        UUID id = prepare();
        jdbc.update("update curated_contents set body='변경된 질문' where id=?", id);
        telegram.update(1, id, "p", 0, 456, 123, messageId(id));
        service.pollScheduled();
        assertThat(status(id)).isEqualTo("DRAFT");
        assertThat(telegram.lastEdited.get("text").toString()).contains("변경된 질문");
        telegram.update(2, id, "p", 1, 456, 123, messageId(id));
        service.pollScheduled();
        assertThat(status(id)).isEqualTo("PUBLISHED");
    }

    private UUID prepare() {
        service.generateForDate(DAY);
        service.pollScheduled();
        return jdbc.queryForObject("select content_id from curated_telegram_reviews order by content_id limit 1", UUID.class);
    }
    private int count(String table) { return jdbc.queryForObject("select count(*) from " + table, Integer.class); }
    private String status(UUID id) { return jdbc.queryForObject("select status from curated_contents where id=?", String.class, id); }
    private String body(UUID id) { return jdbc.queryForObject("select body from curated_contents where id=?", String.class, id); }
    private long messageId(UUID id) { return jdbc.queryForObject("select message_id from curated_telegram_reviews where content_id=?", Long.class, id); }

    private static class FakeTelegram extends CuratorTelegramClient {
        final List<String> methods = new ArrayList<>();
        final List<Map<String, Object>> updates = new ArrayList<>();
        Map<String, Object> lastEdited = Map.of();
        long messageId = 100;
        boolean failDelivery;
        String webhook = "";
        FakeTelegram() { super(TELEGRAM); }
        @Override public JsonNode call(String method, Map<String, Object> payload) {
            methods.add(method);
            if (method.equals("getWebhookInfo")) return JSON.valueToTree(Map.of("url", webhook));
            if (method.equals("getUpdates")) {
                long offset = ((Number) payload.get("offset")).longValue();
                return JSON.valueToTree(updates.stream().filter(u -> ((Number) u.get("update_id")).longValue() >= offset).toList());
            }
            if (method.equals("sendMessage") || method.equals("editMessageText")) {
                if (failDelivery) throw new IllegalStateException("offline");
                if (method.equals("editMessageText")) lastEdited = new LinkedHashMap<>(payload);
                return JSON.valueToTree(Map.of("message_id", ++messageId));
            }
            return JSON.valueToTree(true);
        }
        void update(long updateId, UUID contentId, String action, int revision, long user, long chat, long message) {
            updates.add(Map.of("update_id", updateId, "callback_query", Map.of("id", "callback-" + updateId,
                    "from", Map.of("id", user), "message", Map.of("message_id", message, "chat", Map.of("id", chat)),
                    "data", "cur:" + action + ":" + contentId + ":" + revision)));
        }
    }
}
