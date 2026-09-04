package com.watchlog.api.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.dto.CreateCuratedDraftRequest;
import com.watchlog.api.dto.CuratedContentAdminDto;
import com.watchlog.api.dto.CuratedTitleOptionDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CuratedContentAdminService {

    private static final UUID CURATOR_ACTOR_ID = UUID.fromString("00000000-0000-4000-8000-000000000001");
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final CuratedPromptGenerator promptGenerator;
    private final String adminToken;

    @Autowired
    public CuratedContentAdminService(
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper,
            CuratedPromptGenerator promptGenerator,
            @Value("${admin.curated-content.token:${admin.analytics.token:}}") String adminToken
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.promptGenerator = promptGenerator;
        this.adminToken = adminToken;
    }

    public CuratedContentAdminService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper, String adminToken) {
        this(jdbcTemplate, objectMapper, new CuratedPromptGenerator(), adminToken);
    }

    @Transactional
    public CuratedContentAdminDto createDraft(String token, CreateCuratedDraftRequest request) {
        verifyAdminToken(token);
        if (request == null || request.titleId() == null) {
            throw new IllegalArgumentException("titleId is required");
        }

        String locale = normalizeLocale(request.locale());
        TitleSnapshot title = findTitle(request.titleId());
        if (title == null) {
            throw new IllegalArgumentException("Title not found: " + request.titleId());
        }

        boolean manual = request.body() != null && !request.body().isBlank();
        String body = normalizeBody(manual
                ? request.body()
                : promptGenerator.generate(title.name(), title.type(), locale));
        String contentHash = sha256(locale + "\nPROMPT\n" + body);
        Integer existing = jdbcTemplate.queryForObject(
                "select count(*) from curated_contents where actor_id = ? and title_id = ? and locale = ? and kind = 'PROMPT' and content_hash = ?",
                Integer.class, CURATOR_ACTOR_ID, title.id(), locale, contentHash);
        if (existing != null && existing > 0) {
            throw new IllegalArgumentException("Curated content with the same hash already exists");
        }

        Map<String, Object> source = new LinkedHashMap<>();
        source.put("generator", manual ? "manual" : "template-v1");
        source.put("titleName", title.name());
        source.put("titleType", title.type().name());
        source.put("locale", locale);
        String sourceJson = toJson(source);
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into curated_contents
                    (id, actor_id, title_id, locale, kind, body, status, model, prompt_version, source_json, content_hash)
                values (?, ?, ?, ?, 'PROMPT', ?, 'DRAFT', null, ?, ?::jsonb, ?)
                """, id, CURATOR_ACTOR_ID, title.id(), locale, body,
                manual ? "manual-v1" : "template-v1", sourceJson, contentHash);
        return get(token, id);
    }

    @Transactional
    public CuratedContentAdminDto publish(String token, UUID id) {
        verifyAdminToken(token);
        CuratedContentAdminDto content = get(token, id);
        if ("PUBLISHED".equals(content.status())) return content;
        if (!"DRAFT".equals(content.status())) {
            throw new IllegalArgumentException("Only draft content can be published");
        }
        Integer existing = jdbcTemplate.queryForObject("""
                select count(*)
                from curated_contents
                where actor_id = (select actor_id from curated_contents where id = ?)
                  and title_id = ?
                  and locale = ?
                  and kind = ?
                  and status = 'PUBLISHED'
                  and id <> ?
                """, Integer.class, id, content.titleId(), content.locale(), content.kind(), id);
        if (existing != null && existing > 0) {
            throw new IllegalArgumentException("Title already has a published prompt for this locale");
        }
        int updated = jdbcTemplate.update("""
                update curated_contents
                   set status = 'PUBLISHED', published_at = now(), updated_at = now()
                 where id = ? and status = 'DRAFT'
                """, id);
        if (updated == 0) throw new IllegalArgumentException("Draft content not found: " + id);
        return get(token, id);
    }

    @Transactional
    public CuratedContentAdminDto disable(String token, UUID id) {
        verifyAdminToken(token);
        int updated = jdbcTemplate.update("""
                update curated_contents
                   set status = 'DISABLED', updated_at = now()
                 where id = ? and status <> 'DISABLED'
                """, id);
        if (updated == 0) {
            // Keep the operation idempotent for an already disabled card, but still return a useful 404.
            if (!exists(id)) throw new IllegalArgumentException("Curated content not found: " + id);
        }
        return get(token, id);
    }

    @Transactional(readOnly = true)
    public List<CuratedContentAdminDto> list(String token, String status, String locale, int limit) {
        verifyAdminToken(token);
        int safeLimit = Math.max(1, Math.min(limit, 200));
        List<Object> params = new ArrayList<>();
        StringBuilder sql = new StringBuilder("""
                select c.id, c.title_id, t.name as title_name, t.type as title_type, t.year as title_year,
                       t.poster_url, c.locale, c.kind, c.body, c.status, a.actor_key, a.actor_type,
                       a.display_name as actor_display_name, a.disclosure, c.model, c.prompt_version,
                       c.source_json::text as source_json, c.published_at, c.created_at, c.updated_at
                from curated_contents c
                join system_actors a on a.id = c.actor_id
                join titles t on t.id = c.title_id
                where a.actor_type = 'AI_CURATOR'
                  and t.deleted_at is null
                """);
        if (status != null && !status.isBlank()) {
            String normalizedStatus = status.trim().toUpperCase();
            if (!List.of("DRAFT", "PUBLISHED", "DISABLED").contains(normalizedStatus)) {
                throw new IllegalArgumentException("status must be DRAFT, PUBLISHED, or DISABLED");
            }
            sql.append(" and c.status = ?");
            params.add(normalizedStatus);
        }
        if (locale != null && !locale.isBlank()) {
            sql.append(" and c.locale = ?");
            params.add(normalizeLocale(locale));
        }
        sql.append(" order by c.created_at desc limit ?");
        params.add(safeLimit);
        return jdbcTemplate.query(sql.toString(), this::mapAdmin, params.toArray());
    }

    @Transactional(readOnly = true)
    public List<CuratedTitleOptionDto> searchTitles(String token, String query, int limit) {
        verifyAdminToken(token);
        String normalizedQuery = query == null ? "" : query.trim();
        if (normalizedQuery.isEmpty()) return List.of();
        int safeLimit = Math.max(1, Math.min(limit, 20));
        return jdbcTemplate.query("""
                select id, name, type, year, poster_url
                from titles
                where deleted_at is null and name ilike ?
                order by name asc
                limit ?
                """, (rs, rowNum) -> new CuratedTitleOptionDto(
                rs.getObject("id", UUID.class),
                rs.getString("name"),
                TitleType.valueOf(rs.getString("type")),
                rs.getObject("year", Integer.class),
                rs.getString("poster_url")
        ), "%" + normalizedQuery + "%", safeLimit);
    }

    @Transactional(readOnly = true)
    public CuratedContentAdminDto get(String token, UUID id) {
        verifyAdminToken(token);
        try {
            return jdbcTemplate.queryForObject("""
                    select c.id, c.title_id, t.name as title_name, t.type as title_type, t.year as title_year,
                           t.poster_url, c.locale, c.kind, c.body, c.status, a.actor_key, a.actor_type,
                           a.display_name as actor_display_name, a.disclosure, c.model, c.prompt_version,
                           c.source_json::text as source_json, c.published_at, c.created_at, c.updated_at
                    from curated_contents c
                    join system_actors a on a.id = c.actor_id
                    join titles t on t.id = c.title_id
                    where c.id = ? and a.actor_type = 'AI_CURATOR'
                    """, this::mapAdmin, id);
        } catch (EmptyResultDataAccessException e) {
            throw new IllegalArgumentException("Curated content not found: " + id);
        }
    }

    private CuratedContentAdminDto mapAdmin(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new CuratedContentAdminDto(
                rs.getObject("id", UUID.class),
                rs.getObject("title_id", UUID.class),
                rs.getString("title_name"),
                TitleType.valueOf(rs.getString("title_type")),
                rs.getObject("title_year", Integer.class),
                rs.getString("poster_url"),
                rs.getString("locale"),
                rs.getString("kind"),
                rs.getString("body"),
                rs.getString("status"),
                rs.getString("actor_key"),
                rs.getString("actor_type"),
                rs.getString("actor_display_name"),
                rs.getString("disclosure"),
                rs.getString("model"),
                rs.getString("prompt_version"),
                parseJson(rs.getString("source_json")),
                rs.getObject("published_at", OffsetDateTime.class),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class)
        );
    }

    private TitleSnapshot findTitle(UUID id) {
        try {
            return jdbcTemplate.queryForObject("""
                    select id, name, type
                    from titles
                    where id = ? and deleted_at is null
                    """, (rs, rowNum) -> new TitleSnapshot(
                    rs.getObject("id", UUID.class),
                    rs.getString("name"),
                    TitleType.valueOf(rs.getString("type"))
            ), id);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private boolean exists(UUID id) {
        Integer count = jdbcTemplate.queryForObject("select count(*) from curated_contents where id = ?", Integer.class, id);
        return count != null && count > 0;
    }

    private void verifyAdminToken(String token) {
        if (adminToken == null || adminToken.isBlank()) throw new IllegalArgumentException("Admin token is not configured");
        if (!adminToken.equals(token)) throw new IllegalArgumentException("Invalid admin token");
    }

    private String normalizeLocale(String locale) {
        if (locale == null || locale.isBlank()) return "ko";
        String normalized = locale.trim().split("[-_]")[0].toLowerCase();
        if (!normalized.equals("ko") && !normalized.equals("en")) {
            throw new IllegalArgumentException("locale must be ko or en");
        }
        return normalized;
    }

    private String normalizeBody(String body) {
        String trimmed = body == null ? "" : body.trim();
        if (trimmed.isEmpty()) throw new IllegalArgumentException("body is required");
        if (trimmed.length() > 2000) throw new IllegalArgumentException("body must be 2000 characters or fewer");
        return trimmed;
    }

    private String toJson(Map<String, Object> source) {
        try {
            return objectMapper.writeValueAsString(source);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Could not serialize source metadata", e);
        }
    }

    private Map<String, Object> parseJson(String sourceJson) {
        try {
            return objectMapper.readValue(sourceJson, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private record TitleSnapshot(UUID id, String name, TitleType type) {}
}
