package com.watchlog.api.service;

import com.watchlog.api.domain.TitleType;
import com.watchlog.api.dto.CuratedContentDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CuratedContentService {

    private final JdbcTemplate jdbcTemplate;

    public CuratedContentService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public List<CuratedContentDto> listPublished(String language, int limit) {
        String locale = normalizeLocale(language);
        int safeLimit = Math.max(1, Math.min(limit, 20));

        return jdbcTemplate.query("""
                select c.id,
                       c.title_id,
                       t.name as title_name,
                       t.type as title_type,
                       t.year as title_year,
                       t.poster_url,
                       c.kind,
                       c.body,
                       a.actor_key,
                       a.actor_type,
                       a.display_name as actor_display_name,
                       a.disclosure,
                       c.published_at
                from curated_contents c
                join system_actors a on a.id = c.actor_id
                join titles t on t.id = c.title_id
                where c.locale = ?
                  and c.status = 'PUBLISHED'
                  and a.actor_type = 'AI_CURATOR'
                  and a.active = true
                  and t.deleted_at is null
                order by c.published_at desc, c.created_at desc
                limit ?
                """, (rs, rowNum) -> new CuratedContentDto(
                rs.getObject("id", java.util.UUID.class),
                rs.getObject("title_id", java.util.UUID.class),
                rs.getString("title_name"),
                TitleType.valueOf(rs.getString("title_type")),
                rs.getObject("title_year", Integer.class),
                rs.getString("poster_url"),
                rs.getString("kind"),
                rs.getString("body"),
                rs.getString("actor_key"),
                rs.getString("actor_type"),
                rs.getString("actor_display_name"),
                rs.getString("disclosure"),
                rs.getObject("published_at", java.time.OffsetDateTime.class)
        ), locale, safeLimit);
    }

    private String normalizeLocale(String language) {
        if (language == null || language.isBlank()) return "ko";
        String locale = language.split(",")[0].trim().split("-")[0].toLowerCase();
        return switch (locale) {
            case "en" -> "en";
            default -> "ko";
        };
    }
}
