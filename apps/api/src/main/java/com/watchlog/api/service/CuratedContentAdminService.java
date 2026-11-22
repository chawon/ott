package com.watchlog.api.service;

import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.dto.CreateCuratedDraftRequest;
import com.watchlog.api.dto.CuratedContentAdminDto;
import com.watchlog.api.dto.CuratedTitleOptionDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CuratedContentAdminService {
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final String adminToken;

    public CuratedContentAdminService(
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper,
            @Value("${admin.curated-content.token:${admin.analytics.token:}}") String adminToken
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.adminToken = adminToken;
    }

    public CuratedContentAdminDto createDraft(String token, CreateCuratedDraftRequest request) {
        verifyAdminToken(token);
        throw retired();
    }

    public CuratedContentAdminDto publish(String token, UUID id) {
        verifyAdminToken(token);
        throw retired();
    }

    public CuratedContentAdminDto disable(String token, UUID id) {
        verifyAdminToken(token);
        throw retired();
    }

    private ResponseStatusException retired() {
        return new ResponseStatusException(HttpStatus.GONE, "Curator publishing has been retired");
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

    private Map<String, Object> parseJson(String sourceJson) {
        try {
            return objectMapper.readValue(sourceJson, new TypeReference<>() {});
        } catch (JacksonException e) {
            return Map.of();
        }
    }

}
