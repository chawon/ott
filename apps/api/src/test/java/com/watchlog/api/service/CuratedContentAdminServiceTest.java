package com.watchlog.api.service;

import tools.jackson.databind.ObjectMapper;
import com.watchlog.api.dto.CreateCuratedDraftRequest;
import com.watchlog.api.dto.CuratedContentAdminDto;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CuratedContentAdminServiceTest {
    private static CuratorTestDatabase database;
    private static JdbcTemplate jdbc;
    private static CuratedContentAdminService service;
    private static final UUID TITLE_ID = UUID.fromString("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    private static final UUID DRAFT_ID = UUID.fromString("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
    private static final UUID PUBLISHED_ID = UUID.fromString("ffffffff-ffff-4fff-8fff-ffffffffffff");

    @BeforeAll
    static void setUpDatabase() {
        database = new CuratorTestDatabase();
        jdbc = database.jdbc;
        service = new CuratedContentAdminService(jdbc, new ObjectMapper(), "test-admin-token");
    }

    @AfterAll
    static void stopDatabase() {
        if (database != null) database.close();
    }

    @BeforeEach
    void historicalFixture() {
        jdbc.update("delete from curated_telegram_actions");
        jdbc.update("delete from curated_telegram_reviews");
        jdbc.update("delete from curated_contents");
        jdbc.update("delete from titles where id = ?", TITLE_ID);
        jdbc.update("insert into titles (id, type, name, year) values (?, 'movie', '인셉션', 2010)", TITLE_ID);
        jdbc.update("""
                insert into curated_contents
                    (id, actor_id, title_id, locale, kind, body, status, content_hash, published_at)
                values (?, '00000000-0000-4000-8000-000000000001', ?, 'ko', 'PROMPT',
                        '보관된 초안', 'DRAFT', 'draft-history', null),
                       (?, '00000000-0000-4000-8000-000000000001', ?, 'ko', 'PROMPT',
                        '보관된 게시물', 'PUBLISHED', 'published-history', '2026-09-06T00:00:00Z')
                """, DRAFT_ID, TITLE_ID, PUBLISHED_ID, TITLE_ID);
        jdbc.update("""
                insert into curated_telegram_reviews
                    (content_id, generation_date, chat_id, message_id, reviewed_body, rendered_status)
                values (?, '2026-09-06', 'test-chat', 17, '검토한 초안', 'DRAFT')
                """, DRAFT_ID);
        jdbc.update("""
                insert into curated_telegram_actions
                    (update_id, content_id, telegram_user_id, action, revision, body)
                values (10, ?, 123, 'p', 0, '게시 승인 이력')
                """, PUBLISHED_ID);
        jdbc.update("update curated_telegram_state set next_update_id=11 where id=1");
    }

    @Test
    void historicalAdminReadStillWorks() {
        assertThat(service.list("test-admin-token", null, null, 20))
                .extracting(CuratedContentAdminDto::id).containsExactlyInAnyOrder(DRAFT_ID, PUBLISHED_ID);
        assertThat(service.get("test-admin-token", PUBLISHED_ID).status()).isEqualTo("PUBLISHED");
        assertHistoryPreserved();
    }

    @Test
    void draftCreationIsGoneAndDoesNotChangeHistory() {
        assertGone(() -> service.createDraft("test-admin-token",
                new CreateCuratedDraftRequest(TITLE_ID, "ko", "새 질문")));
        assertHistoryPreserved();
    }

    @Test
    void publicationIsGoneAndDoesNotChangeHistory() {
        assertGone(() -> service.publish("test-admin-token", DRAFT_ID));
        assertHistoryPreserved();
    }

    @Test
    void disablingIsGoneAndDoesNotChangeHistory() {
        assertGone(() -> service.disable("test-admin-token", PUBLISHED_ID));
        assertHistoryPreserved();
    }

    @Test
    void adminAuthenticationIsCheckedBeforeRetirementResponse() {
        assertThatThrownBy(() -> service.createDraft("wrong-token",
                new CreateCuratedDraftRequest(TITLE_ID, "ko", null)))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Invalid admin token");
        assertHistoryPreserved();
    }

    private void assertGone(org.assertj.core.api.ThrowableAssert.ThrowingCallable call) {
        assertThatThrownBy(call).isInstanceOfSatisfying(ResponseStatusException.class,
                error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.GONE));
    }

    private void assertHistoryPreserved() {
        assertThat(jdbc.queryForObject("select count(*) from curated_contents", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select status from curated_contents where id=?", String.class, DRAFT_ID))
                .isEqualTo("DRAFT");
        assertThat(jdbc.queryForObject("select status from curated_contents where id=?", String.class, PUBLISHED_ID))
                .isEqualTo("PUBLISHED");
        assertThat(jdbc.queryForObject("select count(*) from curated_telegram_reviews", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from curated_telegram_actions", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select next_update_id from curated_telegram_state where id=1", Long.class))
                .isEqualTo(11L);
    }
}
