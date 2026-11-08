package com.watchlog.api.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.watchlog.api.dto.RecommendationState;
import com.watchlog.api.llm.RecommendationItem;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.*;
import java.util.*;

/** Durable account choices and short transactions around a generation lease. No network inside these transactions. */
@Repository
public class RecommendationAccountStore {
    static final int DAILY_LIMIT = 3;
    static final ZoneId DAY_ZONE = ZoneId.of("Asia/Seoul");
    private static final Duration LEASE_DURATION = Duration.ofMinutes(2);
    private static final ObjectMapper JSON = new ObjectMapper();
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final TransactionTemplate snapshot;
    private final Clock clock;

    @Autowired
    public RecommendationAccountStore(JdbcTemplate jdbc, PlatformTransactionManager manager) {
        this(jdbc, manager, Clock.systemUTC());
    }

    RecommendationAccountStore(JdbcTemplate jdbc, PlatformTransactionManager manager, Clock clock) {
        this.jdbc = jdbc;
        this.transaction = new TransactionTemplate(manager);
        this.snapshot = new TransactionTemplate(manager);
        this.snapshot.setReadOnly(true);
        this.snapshot.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_REPEATABLE_READ);
        this.snapshot.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.clock = clock;
    }

    public record Batch(UUID generationId, String providerKey, List<RecommendationItem> items, OffsetDateTime generatedAt) {}
    public record Exclusion(String key, RecommendationItem item) {
        public Map<String, Object> view() {
            Map<String, Object> value = new LinkedHashMap<>(JSON.convertValue(item, new TypeReference<>() {}));
            value.put("key", key);
            return value;
        }
    }
    public enum Claim { ACQUIRED, REUSED, IN_PROGRESS, LIMIT_REACHED }
    private record Account(LocalDate date, int used, UUID lease, OffsetDateTime expires) {}
    private record Attempt(String status, String language) {}

    public OffsetDateTime now() { return OffsetDateTime.now(clock); }
    public LocalDate today() { return now().atZoneSameInstant(DAY_ZONE).toLocalDate(); }
    public boolean isToday(OffsetDateTime date) { return date.atZoneSameInstant(DAY_ZONE).toLocalDate().equals(today()); }

    public <T> T readSnapshot(java.util.function.Supplier<T> read) {
        return snapshot.execute(status -> read.get());
    }

    public RecommendationState.Quota quota(UUID userId) {
        LocalDate day = today();
        var state = account(userId, false);
        int used = state == null || !day.equals(state.date()) ? 0 : state.used();
        return new RecommendationState.Quota(day.toString(), DAY_ZONE.getId(), DAILY_LIMIT, used,
                Math.max(0, DAILY_LIMIT - used), day.plusDays(1).atStartOfDay(DAY_ZONE).toOffsetDateTime());
    }

    public boolean generating(UUID userId) {
        var state = account(userId, false);
        return state != null && state.lease() != null && state.expires() != null && state.expires().isAfter(now());
    }

    public Optional<Batch> batch(UUID userId, String language) {
        return jdbc.query("select generation_id, provider_key, items_json, generated_at from recommendation_batches where user_id=? and language=?",
                (rs, row) -> new Batch(rs.getObject(1, UUID.class), rs.getString(2), readItems(rs.getString(3)),
                        rs.getObject(4, OffsetDateTime.class)), userId, language).stream().findFirst();
    }

    public List<Exclusion> exclusions(UUID userId) {
        return jdbc.query("select exclusion_key, item_json from recommendation_exclusions where user_id=? order by updated_at, exclusion_key",
                (rs, row) -> new Exclusion(rs.getString(1), readItem(rs.getString(2))), userId);
    }

    public Exclusion putExclusion(UUID userId, RecommendationItem item) {
        var safe = validate(item);
        return transaction.execute(status -> {
            ensureAccount(userId);
            account(userId, true);
            var existing = exclusions(userId).stream().filter(entry -> RecommendationTitleMatcher.matches(entry.item(), safe)).findFirst();
            String key = existing.map(Exclusion::key).orElseGet(() -> RecommendationTitleMatcher.key(safe));
            RecommendationItem merged = existing.map(entry -> combine(entry.item(), safe)).orElse(safe);
            jdbc.update("""
                    insert into recommendation_exclusions(user_id,exclusion_key,item_json,updated_at) values(?,?,?,?)
                    on conflict(user_id,exclusion_key) do update set item_json=excluded.item_json,updated_at=excluded.updated_at
                    """, userId, key, json(merged), now());
            return new Exclusion(key, merged);
        });
    }

    public void removeExclusion(UUID userId, String key) {
        if (key == null || !key.matches("[a-f0-9]{64}")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid exclusion key");
        transaction.executeWithoutResult(status -> {
            ensureAccount(userId);
            account(userId, true);
            jdbc.update("delete from recommendation_exclusions where user_id=? and exclusion_key=?", userId, key);
        });
    }

    public Claim claim(UUID userId, UUID requestId, String language, String providerKey, OffsetDateTime requestedAt) {
        return transaction.execute(status -> {
            ensureAccount(userId);
            var state = account(userId, true);
            var attempts = jdbc.query("select status,language from recommendation_generation_attempts where user_id=? and request_id=?",
                    (rs,row) -> new Attempt(rs.getString(1), rs.getString(2)), userId, requestId);
            if (!attempts.isEmpty() && !language.equals(attempts.getFirst().language())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Request ID belongs to another language");
            }
            if (attempts.stream().anyMatch(attempt -> "COMPLETED".equals(attempt.status()))) return Claim.REUSED;
            // Another process may be doing this account's generation. The caller polls read-only state.
            if (state.lease() != null && state.expires() != null && state.expires().isAfter(now())) {
                if (!requestId.equals(state.lease())) {
                    jdbc.update("""
                            insert into recommendation_generation_attempts(user_id,request_id,owner_request_id,language,status,started_at)
                            values(?,?,?,?,'PENDING',?) on conflict(user_id,request_id) do update set
                            owner_request_id=excluded.owner_request_id,status='PENDING',started_at=excluded.started_at,completed_at=null
                            """, userId, requestId, state.lease(), language, now());
                }
                return Claim.IN_PROGRESS;
            }
            var recent = batch(userId, language);
            if (recent.isPresent() && providerKey.equals(recent.get().providerKey())
                    && recent.get().generatedAt().isAfter(requestedAt)) return Claim.REUSED;
            LocalDate day = today();
            int used = day.equals(state.date()) ? state.used() : 0;
            if (used >= DAILY_LIMIT) return Claim.LIMIT_REACHED;
            if (state.lease() != null) {
                jdbc.update("update recommendation_generation_attempts set status='FAILED',completed_at=? where user_id=? and (request_id=? or owner_request_id=?) and status='PENDING'",
                        now(), userId, state.lease(), state.lease());
            }
            jdbc.update("update recommendation_account_state set quota_date=?,successful_count=?,lease_id=?,lease_expires_at=?,updated_at=? where user_id=?",
                    day, used, requestId, now().plus(LEASE_DURATION), now(), userId);
            jdbc.update("""
                    insert into recommendation_generation_attempts(user_id,request_id,language,status,started_at) values(?,?,?,'PENDING',?)
                    on conflict(user_id,request_id) do update set language=excluded.language,owner_request_id=null,status='PENDING',started_at=excluded.started_at,completed_at=null
                    """, userId, requestId, language, now());
            jdbc.update("delete from recommendation_generation_attempts where user_id=? and started_at<? and status<>'PENDING'", userId, now().minusDays(7));
            return Claim.ACQUIRED;
        });
    }

    public void complete(UUID userId, UUID requestId, String language, String providerKey, List<RecommendationItem> items) {
        transaction.executeWithoutResult(status -> {
            var state = account(userId, true);
            if (state == null || !requestId.equals(state.lease()) || state.expires() == null || !state.expires().isAfter(now())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Recommendation request is no longer current");
            }
            LocalDate day = today();
            int used = day.equals(state.date()) ? state.used() : 0;
            if (used >= DAILY_LIMIT) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Daily recommendation limit reached");
            jdbc.update("""
                    insert into recommendation_batches(user_id,language,generation_id,provider_key,items_json,generated_at) values(?,?,?,?,?,?)
                    on conflict(user_id,language) do update set generation_id=excluded.generation_id,provider_key=excluded.provider_key,
                    items_json=excluded.items_json,generated_at=excluded.generated_at
                    """, userId, language, requestId, providerKey, json(items), now());
            jdbc.update("update recommendation_account_state set quota_date=?,successful_count=?,lease_id=null,lease_expires_at=null,updated_at=? where user_id=?",
                    day, used + 1, now(), userId);
            jdbc.update("update recommendation_generation_attempts set status='COMPLETED',completed_at=? where user_id=? and request_id=?", now(), userId, requestId);
            jdbc.update("update recommendation_generation_attempts set status=case when language=? then 'COMPLETED' else 'FAILED' end,completed_at=? where user_id=? and owner_request_id=? and status='PENDING'",
                    language, now(), userId, requestId);
        });
    }

    public void fail(UUID userId, UUID requestId) {
        transaction.executeWithoutResult(status -> {
            jdbc.update("update recommendation_account_state set lease_id=null,lease_expires_at=null,updated_at=? where user_id=? and lease_id=?", now(), userId, requestId);
            jdbc.update("update recommendation_generation_attempts set status='FAILED',completed_at=? where user_id=? and (request_id=? or owner_request_id=?) and status='PENDING'", now(), userId, requestId, requestId);
        });
    }

    /** Called inside AuthService's account merge transaction before the source user is deleted. */
    public void merge(UUID fromUserId, UUID toUserId) {
        if (fromUserId.equals(toUserId)) return;
        transaction.executeWithoutResult(status -> {
            if (jdbc.queryForObject("select count(*) from users where id in (?,?)", Long.class, fromUserId, toUserId) != 2L) return;
            // Fixed lock order prevents two concurrent account merges locking in reverse order.
            var ids = java.util.stream.Stream.of(fromUserId, toUserId).sorted().toList();
            ids.forEach(this::ensureAccount);
            ids.forEach(id -> account(id, true));
            var from = account(fromUserId, false);
            var to = account(toUserId, false);
            int used = (today().equals(from.date()) ? from.used() : 0) + (today().equals(to.date()) ? to.used() : 0);
            jdbc.update("update recommendation_account_state set quota_date=?,successful_count=?,lease_id=null,lease_expires_at=null,updated_at=? where user_id=?",
                    today(), Math.min(DAILY_LIMIT, used), now(), toUserId);
            jdbc.update("update recommendation_generation_attempts set status='FAILED',completed_at=? where user_id in (?,?) and status='PENDING'", now(), fromUserId, toUserId);
            jdbc.update("""
                    insert into recommendation_generation_attempts(user_id,request_id,owner_request_id,language,status,started_at,completed_at)
                    select ?,request_id,owner_request_id,language,status,started_at,completed_at from recommendation_generation_attempts where user_id=?
                    on conflict(user_id,request_id) do nothing
                    """, toUserId, fromUserId);
            for (var entry : exclusions(fromUserId)) {
                var duplicate = exclusions(toUserId).stream().filter(other -> RecommendationTitleMatcher.matches(other.item(), entry.item())).findFirst();
                var item = duplicate.map(other -> combine(other.item(), entry.item())).orElse(entry.item());
                String key = duplicate.map(Exclusion::key).orElse(entry.key());
                jdbc.update("""
                        insert into recommendation_exclusions(user_id,exclusion_key,item_json,updated_at) values(?,?,?,?)
                        on conflict(user_id,exclusion_key) do update set item_json=excluded.item_json,updated_at=excluded.updated_at
                        """, toUserId, key, json(item), now());
            }
            jdbc.update("""
                    insert into recommendation_batches(user_id,language,generation_id,provider_key,items_json,generated_at)
                    select ?,language,generation_id,provider_key,items_json,generated_at from recommendation_batches where user_id=?
                    on conflict(user_id,language) do update set generation_id=excluded.generation_id,provider_key=excluded.provider_key,
                    items_json=excluded.items_json,generated_at=excluded.generated_at where recommendation_batches.generated_at<excluded.generated_at
                    """, toUserId, fromUserId);
            // Source rows are removed by the users FK cascade in the same transaction.
        });
    }

    private void ensureAccount(UUID userId) {
        jdbc.update("insert into recommendation_account_state(user_id,quota_date,successful_count) values(?,?,0) on conflict(user_id) do nothing", userId, today());
    }

    private Account account(UUID userId, boolean lock) {
        return jdbc.query("select quota_date,successful_count,lease_id,lease_expires_at from recommendation_account_state where user_id=?" + (lock ? " for update" : ""),
                (rs, row) -> new Account(rs.getObject(1, LocalDate.class), rs.getInt(2), rs.getObject(3, UUID.class), rs.getObject(4, OffsetDateTime.class)), userId)
                .stream().findFirst().orElse(null);
    }

    private static RecommendationItem validate(RecommendationItem item) {
        if (item == null || item.name() == null || item.name().isBlank() || item.name().length() > 255
                || (item.type() != null && !Set.of("movie", "series", "book").contains(item.type()))
                || (item.provider() != null && !Set.of("TMDB", "KAKAO", "NAVER", "GOOGLE_BOOKS", "LOCAL").contains(item.provider()))
                || (item.providerId() != null && item.providerId().length() > 128)
                || (item.author() != null && item.author().length() > 512)
                || (item.originalName() != null && item.originalName().length() > 255)
                || (item.alternateNames() != null && (item.alternateNames().size() > 12
                    || item.alternateNames().stream().anyMatch(n -> n == null || n.length() > 255)))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid recommendation exclusion");
        }
        return item;
    }

    private static RecommendationItem combine(RecommendationItem previous, RecommendationItem next) {
        var aliases = new LinkedHashSet<String>();
        aliases.add(previous.name());
        if (previous.alternateNames() != null) aliases.addAll(previous.alternateNames());
        aliases.add(next.name());
        if (next.alternateNames() != null) aliases.addAll(next.alternateNames());
        return new RecommendationItem(next.name(), next.type() == null ? previous.type() : next.type(), next.reason(), next.genres(), next.posterUrl(),
                next.provider() == null ? previous.provider() : next.provider(), next.providerId() == null ? previous.providerId() : next.providerId(),
                next.year(), aliases.stream().filter(Objects::nonNull).limit(12).toList(),
                next.author() == null ? previous.author() : next.author(), next.isbn10() == null ? previous.isbn10() : next.isbn10(),
                next.isbn13() == null ? previous.isbn13() : next.isbn13(), next.originalName() == null ? previous.originalName() : next.originalName(), next.catalogTitle());
    }

    private static List<RecommendationItem> readItems(String json) {
        try { return JSON.readValue(json, new TypeReference<>() {}); }
        catch (Exception error) { throw new IllegalStateException("Invalid stored recommendation batch"); }
    }

    private static RecommendationItem readItem(String json) {
        try { return JSON.readValue(json, RecommendationItem.class); }
        catch (Exception error) { throw new IllegalStateException("Invalid stored recommendation exclusion"); }
    }

    private static String json(Object value) {
        try { return JSON.writeValueAsString(value); }
        catch (Exception error) { throw new IllegalArgumentException("Invalid recommendation payload"); }
    }
}
