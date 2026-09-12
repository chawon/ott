package com.watchlog.api.book;

import com.watchlog.api.domain.TitleEntity;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.repo.TitleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
class BookEditionRepositoryTest {
    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    @Test
    void actualJpaQueryMatchesLegacyIsbn10AndExcludesOtherEditions() {
        var factory = new LocalContainerEntityManagerFactoryBean();
        factory.setDataSource(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        factory.setPackagesToScan("com.watchlog.api.domain");
        factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "create-drop"));
        factory.afterPropertiesSet();
        try (var em = factory.getObject().createEntityManager()) {
            var id = UUID.randomUUID();
            var legacy = new TitleEntity(id, TitleType.book, "Legacy edition");
            legacy.setProvider("NAVER");
            legacy.setProviderId("8983921986");
            em.getTransaction().begin();
            em.persist(legacy);
            em.getTransaction().commit();
            em.clear();
            var repository = new JpaRepositoryFactory(em).getRepository(TitleRepository.class);
            assertThat(repository.resolveExternalTitle("KAKAO", "9788983921987", TitleType.book, null, null))
                    .get().extracting(TitleEntity::getId).isEqualTo(id);
            assertThat(repository.resolveExternalTitle("KAKAO", "9788983927620", TitleType.book, null, null)).isEmpty();
            assertThat(repository.resolveExternalTitle("TMDB", "9788983921987", TitleType.movie, null, null)).isEmpty();
        } finally { factory.destroy(); }
    }
}
