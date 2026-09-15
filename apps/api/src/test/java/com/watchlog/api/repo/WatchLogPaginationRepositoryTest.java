package com.watchlog.api.repo;

import com.watchlog.api.domain.Status;
import com.watchlog.api.domain.TitleEntity;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.domain.WatchLogEntity;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
class WatchLogPaginationRepositoryTest {
    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    @Test
    void continuesAfterTimestampAndUuidAndFiltersContentType() {
        var factory = new LocalContainerEntityManagerFactoryBean();
        factory.setDataSource(new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()
        ));
        factory.setPackagesToScan("com.watchlog.api.domain");
        factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "create-drop"));
        factory.afterPropertiesSet();

        try (var em = factory.getObject().createEntityManager()) {
            var userId = UUID.fromString("00000000-0000-4000-8000-000000000001");
            var cursorAt = OffsetDateTime.parse("2026-09-14T00:00:00Z");
            var id1 = UUID.fromString("00000000-0000-4000-8000-000000000001");
            var id2 = UUID.fromString("00000000-0000-4000-8000-000000000002");
            var id3 = UUID.fromString("00000000-0000-4000-8000-000000000003");
            var id4 = UUID.fromString("00000000-0000-4000-8000-000000000004");

            em.getTransaction().begin();
            persistLog(em, userId, id1, TitleType.movie, cursorAt);
            persistLog(em, userId, id2, TitleType.book, cursorAt);
            persistLog(em, userId, id3, TitleType.series, cursorAt);
            persistLog(em, userId, id4, TitleType.movie, cursorAt);
            em.getTransaction().commit();
            em.clear();

            var repository = new JpaRepositoryFactory(em).getRepository(WatchLogRepository.class);
            var firstPage = repository.findFiltered(
                    userId, null, null, null, null, null, null, null, null,
                    null, null, true, PageRequest.of(0, 2)
            );
            assertThat(firstPage).extracting(WatchLogEntity::getId).containsExactly(id4, id3);

            var secondPage = repository.findFiltered(
                    userId, null, null, null, null, null, null, null, null,
                    cursorAt, id3, true, PageRequest.of(0, 2)
            );
            assertThat(secondPage).extracting(WatchLogEntity::getId).containsExactly(id2, id1);

            var books = repository.findFiltered(
                    userId, null, null, null, "book", null, null, null, null,
                    null, null, true, PageRequest.of(0, 10)
            );
            assertThat(books).extracting(WatchLogEntity::getId).containsExactly(id2);

            var videos = repository.findFiltered(
                    userId, null, null, null, "video", null, null, null, null,
                    null, null, true, PageRequest.of(0, 10)
            );
            assertThat(videos).extracting(WatchLogEntity::getId).containsExactly(id4, id3, id1);
        } finally {
            factory.destroy();
        }
    }

    private void persistLog(
            jakarta.persistence.EntityManager em,
            UUID userId,
            UUID id,
            TitleType type,
            OffsetDateTime at
    ) {
        var title = new TitleEntity(UUID.randomUUID(), type, "Title " + id);
        var log = new WatchLogEntity(id, title, Status.DONE);
        log.setUserId(userId);
        log.setWatchedAt(at);
        log.setUpdatedAt(at);
        em.persist(title);
        em.persist(log);
    }
}
