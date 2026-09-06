package com.watchlog.api.service;

import com.watchlog.api.domain.TitleType;
import com.watchlog.api.dto.CreateCuratedDraftRequest;
import com.watchlog.api.dto.CuratedContentAdminDto;
import com.watchlog.api.notify.CuratorAutomationProperties;
import com.watchlog.api.notify.CuratorTelegramClient;
import com.watchlog.api.notify.TelegramProperties;
import com.watchlog.api.tmdb.TmdbClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.JsonNode;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CuratorAutomationService {
    private static final Logger log = LoggerFactory.getLogger(CuratorAutomationService.class);
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final CuratedContentAdminService admin;
    private final CuratedPromptGenerator generator;
    private final TmdbClient tmdb;
    private final CuratorTelegramClient telegram;
    private final TelegramProperties telegramProperties;
    private final CuratorAutomationProperties properties;
    private final String token;

    public CuratorAutomationService(JdbcTemplate jdbc, PlatformTransactionManager transactionManager,
            CuratedContentAdminService admin, CuratedPromptGenerator generator, TmdbClient tmdb,
            CuratorTelegramClient telegram, TelegramProperties telegramProperties,
            CuratorAutomationProperties properties,
            @Value("${admin.curated-content.token:${admin.analytics.token:}}") String token) {
        this.jdbc = jdbc;
        this.transaction = new TransactionTemplate(transactionManager);
        this.admin = admin;
        this.generator = generator;
        this.tmdb = tmdb;
        this.telegram = telegram;
        this.telegramProperties = telegramProperties;
        this.properties = properties;
        this.token = token;
        if (properties.enabled() && (!telegramProperties.isConfigured() || token.isBlank())) {
            throw new IllegalArgumentException("Curator automation requires Telegram and admin credentials");
        }
    }

    // A dedicated database lock is shared by all automation tasks across replicas.
    private void locked(Runnable work) {
        transaction.executeWithoutResult(status -> {
            if (Boolean.TRUE.equals(jdbc.queryForObject("select pg_try_advisory_xact_lock(731031)", Boolean.class))) {
                work.run();
            }
        });
    }

    @Scheduled(cron = "${curator.automation.schedule:0 */10 * * * *}", zone = "Asia/Seoul", scheduler = "curatorTaskScheduler")
    public void generateScheduled() {
        if (!properties.enabled()) return;
        var now = ZonedDateTime.now(ZoneId.of("Asia/Seoul"));
        if (now.toLocalTime().isBefore(java.time.LocalTime.of(9, 30))) return;
        try {
            generateForDate(now.toLocalDate());
        } catch (RuntimeException ex) {
            log.warn("Curator generation failed ({})", ex.getClass().getSimpleName());
        }
    }

    public void generateForDate(LocalDate date) {
        if (!properties.enabled()) return;
        locked(() -> {
            int daily = jdbc.queryForObject("select count(*) from curated_telegram_reviews where generation_date = ?", Integer.class, date);
            int pending = jdbc.queryForObject("select count(*) from curated_telegram_reviews r join curated_contents c on c.id=r.content_id where c.status='DRAFT'", Integer.class);
            int count = Math.min(properties.dailyLimit() - daily, properties.pendingLimit() - pending);
            if (count <= 0) return;
            // Do not send un-actionable drafts when a webhook already owns this bot.
            if (!telegram.call("getWebhookInfo", Map.of()).path("url").asText("").isBlank()) {
                throw new IllegalStateException("Curator bot has an active webhook");
            }
            for (var item : tmdb.availablePopular(properties.locale().equals("ko") ? "ko-KR" : "en-US", 40)) {
                if (count <= 0) break;
                if (item.idValue() == null || item.displayName() == null || item.displayName().isBlank()
                        || !List.of("movie", "tv").contains(item.mediaTypeValue())) continue;
                String providerId = item.idValue().toString();
                String type = item.mediaTypeValue().equals("tv") ? "series" : "movie";
                // Existing provider IDs are shared across types: never silently overwrite a movie with a TV title.
                var ids = jdbc.query("select id from titles where provider='TMDB' and provider_id=? and type=? and deleted_at is null",
                        (rs, row) -> rs.getObject(1, UUID.class), providerId, type);
                UUID titleId;
                if (ids.isEmpty()) {
                    titleId = UUID.randomUUID();
                    int inserted = jdbc.update("""
                            insert into titles(id, type, name, year, provider, provider_id, overview, poster_url)
                            values (?, ?, ?, ?, 'TMDB', ?, ?, ?) on conflict do nothing
                            """, titleId, type, item.displayName(), item.displayYear(), providerId,
                            item.overviewValue(), item.posterPathValue() == null ? null : "https://image.tmdb.org/t/p/w342" + item.posterPathValue());
                    if (inserted == 0) continue;
                } else titleId = ids.getFirst();
                int existing = jdbc.queryForObject("""
                        select count(*) from curated_contents where title_id=? and locale=?
                        and (status in ('DRAFT','PUBLISHED') or updated_at >= now() - interval '30 days')
                        """, Integer.class, titleId, properties.locale());
                if (existing > 0) continue;
                // The deterministic initial question must not duplicate an older disabled entry either.
                String titleName = jdbc.queryForObject("select name from titles where id=?", String.class, titleId);
                String body = generator.generate(titleName, TitleType.valueOf(type), properties.locale());
                if (jdbc.queryForObject("select count(*) from curated_contents where title_id=? and locale=? and content_hash=?",
                        Integer.class, titleId, properties.locale(), hash(properties.locale(), body)) > 0) continue;
                var draft = admin.createDraft(token, new CreateCuratedDraftRequest(titleId, properties.locale(), null));
                jdbc.update("insert into curated_telegram_reviews(content_id,generation_date,chat_id,reviewed_body) values (?,?,?,?)",
                        draft.id(), date, telegramProperties.chatId(), draft.body());
                jdbc.update("update curated_contents set source_json=source_json || jsonb_build_object('selection','tmdb-popular') where id=?", draft.id());
                count--;
            }
        });
    }

    @Scheduled(fixedDelayString = "${curator.automation.poll-delay-ms:5000}", scheduler = "curatorTaskScheduler")
    public void pollScheduled() {
        if (!properties.enabled()) return;
        try {
            locked(this::poll);
            locked(this::deliver);
        } catch (RuntimeException ex) {
            log.warn("Curator Telegram processing failed ({})", ex.getClass().getSimpleName());
        }
    }

    private void poll() {
        Long offset = jdbc.queryForObject("select next_update_id from curated_telegram_state where id=1", Long.class);
        var updates = telegram.call("getUpdates", Map.of("offset", offset, "timeout", 0, "limit", 20,
                "allowed_updates", List.of("callback_query")));
        if (!updates.isArray()) throw new IllegalStateException("Invalid Telegram updates response");
        for (var update : updates) {
            if (!update.path("update_id").isIntegralNumber()) continue;
            long updateId = update.path("update_id").asLong();
            if (updateId < offset) continue;
            var callback = update.path("callback_query");
            if (!callback.isMissingNode()) {
                String result = handleCallback(updateId, callback);
                String callbackId = callback.path("id").asText();
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        try {
                            telegram.call("answerCallbackQuery", Map.of("callback_query_id", callbackId, "text", result));
                        } catch (RuntimeException ex) {
                            // An expired acknowledgement must not undo a committed decision.
                            log.warn("Curator callback acknowledgement failed");
                        }
                    }
                });
            }
            jdbc.update("update curated_telegram_state set next_update_id=? where id=1", updateId + 1);
        }
    }

    private String handleCallback(long updateId, JsonNode callback) {
        var message = callback.path("message");
        if (!callback.path("from").path("id").asText().equals(properties.approverUserId())
                || !message.path("chat").path("id").asText().equals(telegramProperties.chatId())) return "승인 권한이 없어요.";
        var parts = callback.path("data").asText("").split(":");
        if (parts.length != 4 || !parts[0].equals("cur") || !List.of("p", "r", "s").contains(parts[1])) return "지원하지 않는 버튼이에요.";
        UUID id;
        int revision;
        try {
            id = UUID.fromString(parts[2]);
            revision = Integer.parseInt(parts[3]);
        } catch (IllegalArgumentException ex) { return "지원하지 않는 버튼이에요."; }
        var reviews = jdbc.query("select * from curated_telegram_reviews where content_id=? for update", (rs, row) ->
                new Review(rs.getObject("content_id", UUID.class), rs.getString("chat_id"), rs.getInt("revision"),
                        rs.getObject("message_id", Long.class), rs.getString("reviewed_body")), id);
        if (reviews.isEmpty()) return "초안을 찾을 수 없어요.";
        var review = reviews.getFirst();
        if (review.messageId() == null || review.messageId() != message.path("message_id").asLong()
                || !review.chatId().equals(telegramProperties.chatId())) return "현재 승인 메시지에서 눌러 주세요.";
        // Lock the content too, serializing Telegram decisions with existing admin operations.
        jdbc.queryForObject("select id from curated_contents where id=? for update", UUID.class, id);
        var content = admin.get(token, id);
        if (!content.status().equals("DRAFT")) return "이미 처리된 초안이에요.";
        if (review.revision() != revision || !review.body().equals(content.body())) return "문구가 바뀌었어요. 최신 메시지를 확인해 주세요.";
        if (jdbc.queryForObject("select count(*) from curated_telegram_actions where update_id=?", Integer.class, updateId) > 0) return "이미 처리했어요.";
        String result;
        if (parts[1].equals("p")) {
            int published = jdbc.queryForObject("select count(*) from curated_contents where title_id=? and locale=? and status='PUBLISHED'", Integer.class,
                    content.titleId(), content.locale());
            if (published > 0) return "이 작품에는 이미 게시된 질문이 있어요.";
            admin.publish(token, id);
            result = "게시했어요.";
        } else if (parts[1].equals("s")) {
            admin.disable(token, id);
            result = "이번 작품은 건너뛰었어요.";
        } else {
            if (revision >= 3) return "준비된 질문을 모두 확인했어요. 게시하거나 건너뛰어 주세요.";
            String body = generator.generateVariant(content.titleName(), content.titleType(), content.locale(), revision + 1);
            if (jdbc.queryForObject("select count(*) from curated_contents where title_id=? and locale=? and content_hash=? and id<>?",
                    Integer.class, content.titleId(), content.locale(), hash(content.locale(), body), id) > 0) return "같은 질문이 이미 있어요. 건너뛰어 주세요.";
            jdbc.update("""
                    update curated_contents set body=?, content_hash=?, prompt_version='template-v2',
                    source_json=source_json || jsonb_build_object('generator','template-v2','variant',?::int), updated_at=now() where id=?
                    """, body, hash(content.locale(), body), revision + 1, id);
            jdbc.update("update curated_telegram_reviews set revision=revision+1,reviewed_body=? where content_id=?", body, id);
            result = "다른 질문으로 바꿨어요. 문구를 확인해 주세요.";
        }
        jdbc.update("insert into curated_telegram_actions(update_id,content_id,telegram_user_id,action,revision,body) values (?,?,?,?,?,?)",
                updateId, id, Long.parseLong(properties.approverUserId()), parts[1], revision, content.body());
        jdbc.update("update curated_telegram_reviews set next_delivery_at=now() where content_id=?", id);
        return result;
    }

    private void deliver() {
        var ids = jdbc.query("""
                select r.content_id from curated_telegram_reviews r join curated_contents c on c.id=r.content_id
                where r.chat_id=? and r.next_delivery_at<=now()
                  and (r.message_id is null or r.rendered_revision<>r.revision or r.rendered_status is distinct from c.status or r.reviewed_body<>c.body)
                order by r.created_at limit 4
                """, (rs, row) -> rs.getObject(1, UUID.class), telegramProperties.chatId());
        for (var id : ids) {
            var content = admin.get(token, id);
            var review = jdbc.queryForObject("select * from curated_telegram_reviews where content_id=?", (rs, row) ->
                    new Review(id, rs.getString("chat_id"), rs.getInt("revision"), rs.getObject("message_id", Long.class), rs.getString("reviewed_body")), id);
            int revision = review.revision();
            if (!review.body().equals(content.body())) {
                revision++;
                jdbc.update("update curated_telegram_reviews set revision=?,reviewed_body=? where content_id=?", revision, content.body(), id);
            }
            var payload = message(content, revision);
            if (review.messageId() != null) payload.put("message_id", review.messageId());
            try {
                var response = telegram.call(review.messageId() == null ? "sendMessage" : "editMessageText", payload);
                Long messageId = review.messageId();
                if (messageId == null) {
                    if (response == null || !response.path("message_id").isIntegralNumber()) throw new IllegalStateException("Missing Telegram message ID");
                    messageId = response.path("message_id").asLong();
                }
                jdbc.update("update curated_telegram_reviews set message_id=?,rendered_revision=?,rendered_status=? where content_id=?",
                        messageId, revision, content.status(), id);
            } catch (RuntimeException ex) {
                jdbc.update("update curated_telegram_reviews set next_delivery_at=now()+interval '5 minutes' where content_id=?", id);
                log.warn("Curator message delivery failed for {}", id);
            }
        }
    }

    private Map<String, Object> message(CuratedContentAdminDto content, int revision) {
        String status = switch (content.status()) {
            case "PUBLISHED" -> "게시 완료";
            case "DISABLED" -> "건너뛰기 완료";
            default -> "승인 대기";
        };
        var payload = new LinkedHashMap<String, Object>();
        payload.put("chat_id", telegramProperties.chatId());
        payload.put("text", "[ottline 큐레이터] " + status + "\n" + content.titleName() + " · " + content.locale()
                + "\n\n" + content.body() + "\n\nAI 운영 계정 · " + (revision + 1) + "번째 문구");
        payload.put("reply_markup", Map.of("inline_keyboard", content.status().equals("DRAFT") ? List.of(List.of(
                button("게시", "p", content.id(), revision), button("다시 생성", "r", content.id(), revision),
                button("건너뛰기", "s", content.id(), revision))) : List.of()));
        payload.put("link_preview_options", content.posterUrl() != null && content.posterUrl().startsWith("https://image.tmdb.org/")
                ? Map.of("url", content.posterUrl(), "prefer_large_media", true, "show_above_text", true)
                : Map.of("is_disabled", true));
        return payload;
    }

    private Map<String, String> button(String text, String action, UUID id, int revision) {
        return Map.of("text", text, "callback_data", "cur:" + action + ":" + id + ":" + revision);
    }

    private static String hash(String locale, String body) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((locale + "\nPROMPT\n" + body).getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }

    private record Review(UUID id, String chatId, int revision, Long messageId, String body) {}
}
