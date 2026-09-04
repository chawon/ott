package com.watchlog.api.service;

import tools.jackson.databind.ObjectMapper;
import com.watchlog.api.dto.CreateCuratedDraftRequest;
import com.watchlog.api.dto.CuratedContentAdminDto;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers(disabledWithoutDocker = true)
class CuratedContentAdminServiceTest {

    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    private static JdbcTemplate jdbcTemplate;
    private static CuratedContentAdminService service;
    private static final UUID TITLE_ID = UUID.fromString("dddddddd-dddd-4ddd-8ddd-dddddddddddd");

    @BeforeAll
    static void setUpDatabase() {
        var dataSource = new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(),
                POSTGRES.getUsername(),
                POSTGRES.getPassword()
        );
        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .load()
                .migrate();
        jdbcTemplate = new JdbcTemplate(dataSource);
        service = new CuratedContentAdminService(jdbcTemplate, new ObjectMapper(), "test-admin-token");
    }

    @BeforeEach
    void clearFixture() {
        jdbcTemplate.update("delete from curated_contents");
        jdbcTemplate.update("delete from titles where id = ?", TITLE_ID);
        jdbcTemplate.update("""
                insert into titles (id, type, name, year)
                values (?, 'movie', '인셉션', 2010)
                """, TITLE_ID);
    }

    @Test
    void createsDeterministicDraftPublishesAndDisablesIt() {
        var draft = service.createDraft(
                "test-admin-token",
                new CreateCuratedDraftRequest(TITLE_ID, "ko", null)
        );

        assertThat(draft.status()).isEqualTo("DRAFT");
        assertThat(draft.body()).contains("인셉션");
        assertThat(draft.promptVersion()).isEqualTo("template-v1");
        assertThat(draft.sourceJson()).containsEntry("generator", "template-v1");

        var published = service.publish("test-admin-token", draft.id());
        assertThat(published.status()).isEqualTo("PUBLISHED");
        assertThat(published.publishedAt()).isNotNull();

        var disabled = service.disable("test-admin-token", draft.id());
        assertThat(disabled.status()).isEqualTo("DISABLED");
        assertThat(service.list("test-admin-token", null, null, 20)).singleElement()
                .extracting(CuratedContentAdminDto::status)
                .isEqualTo("DISABLED");
    }

    @Test
    void rejectsSecondPublishedPromptForTheSameTitleAndLocale() {
        var first = service.createDraft(
                "test-admin-token",
                new CreateCuratedDraftRequest(TITLE_ID, "ko", "첫 번째 질문")
        );
        service.publish("test-admin-token", first.id());

        var second = service.createDraft(
                "test-admin-token",
                new CreateCuratedDraftRequest(TITLE_ID, "ko", "두 번째 질문")
        );

        assertThatThrownBy(() -> service.publish("test-admin-token", second.id()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already has a published prompt");
    }

    @Test
    void rejectsInvalidAdminToken() {
        assertThatThrownBy(() -> service.createDraft(
                "wrong-token",
                new CreateCuratedDraftRequest(TITLE_ID, "ko", null)
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid admin token");
    }
}
