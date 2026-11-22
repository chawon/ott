package com.watchlog.api.service;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CuratedContentServiceTest {
    private static CuratorTestDatabase database;
    private static JdbcTemplate jdbcTemplate;
    private static CuratedContentService service;

    @BeforeAll
    static void setUpDatabase() {
        database = new CuratorTestDatabase();
        jdbcTemplate = database.jdbc;
        service = new CuratedContentService();
    }

    @AfterAll
    static void stopDatabase() {
        if (database != null) database.close();
    }

    @BeforeEach
    void clearFixture() {
        jdbcTemplate.update("delete from curated_contents");
        jdbcTemplate.update("delete from system_actors where actor_key like 'test-%'");
        jdbcTemplate.update("delete from titles where id in (?, ?, ?)",
                UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
                UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
                UUID.fromString("cccccccc-cccc-4ccc-8ccc-cccccccccccc"));
    }

    @Test
    void retiredPublicFeedIsEmptyForBothLocalesAndKeepsHistoricalRows() {
        UUID actorId = UUID.randomUUID();
        UUID publishedTitleId = UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        UUID draftTitleId = UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
        UUID englishTitleId = UUID.fromString("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
        jdbcTemplate.update("""
                insert into titles (id, type, name, year)
                values (?, 'movie', 'Published title', 2026),
                       (?, 'movie', 'Draft title', 2026),
                       (?, 'movie', 'English title', 2026)
                """, publishedTitleId, draftTitleId, englishTitleId);
        jdbcTemplate.update("""
                insert into system_actors (id, actor_key, actor_type, display_name, disclosure)
                values (?, 'test-curator', 'AI_CURATOR', 'ottline 큐레이터', 'AI 운영 계정')
                """, actorId);
        OffsetDateTime publishedAt = OffsetDateTime.parse("2026-09-04T00:00:00+09:00");
        jdbcTemplate.update("""
                insert into curated_contents
                    (id, actor_id, title_id, locale, kind, body, status, content_hash, published_at)
                values (?, ?, ?, 'ko', 'PROMPT', '사람에게 보일 질문', 'PUBLISHED', 'published-hash', ?),
                       (?, ?, ?, 'ko', 'PROMPT', '초안은 보이면 안 돼요', 'DRAFT', 'draft-hash', null),
                       (?, ?, ?, 'en', 'PROMPT', 'English prompt', 'PUBLISHED', 'english-hash', ?)
                """,
                UUID.randomUUID(), actorId, publishedTitleId, publishedAt,
                UUID.randomUUID(), actorId, draftTitleId,
                UUID.randomUUID(), actorId, englishTitleId, publishedAt);

        assertThat(service.listPublished("ko", 20)).isEmpty();
        assertThat(service.listPublished("en-US,en;q=0.9", 6)).isEmpty();
        assertThat(jdbcTemplate.queryForObject("select count(*) from curated_contents", Integer.class)).isEqualTo(3);
        assertThat(jdbcTemplate.queryForObject("select count(*) from curated_contents where status='PUBLISHED'", Integer.class))
                .isEqualTo(2);
    }
}
