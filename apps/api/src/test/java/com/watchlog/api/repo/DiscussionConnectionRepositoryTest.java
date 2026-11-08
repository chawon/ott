package com.watchlog.api.repo;

import com.watchlog.api.domain.CommentEntity;
import com.watchlog.api.domain.DiscussionEntity;
import com.watchlog.api.domain.TitleEntity;
import com.watchlog.api.domain.TitleType;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Real JPA/native SQL on local PostgreSQL, isolated from all existing user tables. */
@EnabledIfEnvironmentVariable(named = "OTTLINE_DISCUSSION_DB_TEST", matches = "1")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DiscussionConnectionRepositoryTest {
    private final UUID viewer = UUID.randomUUID(), other = UUID.randomUUID();
    private LocalContainerEntityManagerFactoryBean factory;
    private EntityManager em;
    private DiscussionConnectionRepository repository;
    private JdbcTemplate admin;
    private String schema;

    @BeforeAll
    void setup() {
        String url = System.getenv().getOrDefault("OTTLINE_TEST_DATABASE_URL", "jdbc:postgresql://127.0.0.1:5433/watchlog");
        assertThat(url).matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost)(:|/).*");
        String username = System.getenv().getOrDefault("OTTLINE_TEST_DATABASE_USER", "watchlog");
        String password = System.getenv().getOrDefault("OTTLINE_TEST_DATABASE_PASSWORD", "watchlog");
        admin = new JdbcTemplate(new DriverManagerDataSource(url, username, password));
        schema = "discussion_connection_qa_" + UUID.randomUUID().toString().replace("-", "");
        admin.execute("create schema " + schema);
        var source = new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema, username, password);
        factory = new LocalContainerEntityManagerFactoryBean();
        factory.setDataSource(source);
        factory.setPackagesToScan("com.watchlog.api.domain");
        factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "create-drop", "hibernate.default_schema", schema));
        factory.afterPropertiesSet();
        em = factory.getObject().createEntityManager();
        repository = new JpaRepositoryFactory(em).getRepository(DiscussionConnectionRepository.class);
    }

    @AfterAll
    void cleanup() {
        if (em != null) em.close();
        if (factory != null) factory.destroy();
        if (admin != null && schema != null) admin.execute("drop schema " + schema + " cascade");
    }

    @Test
    void emptyAndUnknownDiscussionsDoNotBecomePublicConnections() {
        var discussion = discussion(TitleType.movie);
        em.getTransaction().begin();
        discussion.setCommentSeq(900);
        em.getTransaction().commit();
        long before = commentsCount();
        assertThat(repository.findConnectionId(discussion.getTitle().getId(), viewer)).isEmpty();
        assertThat(repository.findConnectionId(UUID.randomUUID(), viewer)).isEmpty();
        assertThat(commentsCount()).isEqualTo(before);
    }

    @Test
    void detectsAnotherPersonAfterTwoHundredOwnCommentsAndStopsAfterDeletion() {
        var discussion = discussion(TitleType.movie);
        em.getTransaction().begin();
        for (int i = 0; i < 220; i++) em.persist(comment(discussion, viewer, "My earlier public note " + i));
        discussion.setCommentSeq(221);
        em.getTransaction().commit();
        assertThat(repository.findConnectionId(discussion.getTitle().getId(), viewer)).isEmpty();

        var contribution = comment(discussion, other, "Someone else's public note");
        persist(contribution);
        long before = commentsCount();
        assertThat(repository.findConnectionId(discussion.getTitle().getId(), viewer)).contains(discussion.getId());
        assertThat(commentsCount()).isEqualTo(before);

        em.getTransaction().begin();
        em.remove(contribution);
        em.getTransaction().commit();
        assertThat(repository.findConnectionId(discussion.getTitle().getId(), viewer)).isEmpty();
    }

    @Test
    void realLegacyAnonymousTextCountsButWhitespaceDoesNot() {
        var discussion = discussion(TitleType.series);
        persist(comment(discussion, other, " \t\n "));
        persist(comment(discussion, null, "   "));
        assertThat(repository.findConnectionId(discussion.getTitle().getId(), viewer)).isEmpty();
        persist(comment(discussion, null, "A public thought from an earlier version"));
        assertThat(repository.findConnectionId(discussion.getTitle().getId(), viewer)).contains(discussion.getId());
    }

    @Test
    void exactTitleIdsKeepFilmsSeriesAndBookEditionsSeparate() {
        var movie = discussion(TitleType.movie);
        var series = discussion(TitleType.series);
        var firstEdition = discussion(TitleType.book);
        var anotherEdition = discussion(TitleType.book);
        persist(comment(movie, other, "A film discussion"));
        persist(comment(firstEdition, other, "A note about this edition"));
        assertThat(repository.findConnectionId(movie.getTitle().getId(), viewer)).contains(movie.getId());
        assertThat(repository.findConnectionId(series.getTitle().getId(), viewer)).isEmpty();
        assertThat(repository.findConnectionId(firstEdition.getTitle().getId(), viewer)).contains(firstEdition.getId());
        assertThat(repository.findConnectionId(anotherEdition.getTitle().getId(), viewer)).isEmpty();
    }

    @Test
    void softDeletedTitlesHaveNoDestinationEvenWithPublicComments() {
        var discussion = discussion(TitleType.movie);
        persist(comment(discussion, other, "A public thought"));
        em.getTransaction().begin();
        discussion.getTitle().setDeletedAt(OffsetDateTime.now());
        em.getTransaction().commit();
        assertThat(repository.findConnectionId(discussion.getTitle().getId(), viewer)).isEmpty();
    }

    private DiscussionEntity discussion(TitleType type) {
        var title = new TitleEntity(UUID.randomUUID(), type, "Same visible title");
        var discussion = new DiscussionEntity(UUID.randomUUID(), title, "ko");
        em.getTransaction().begin();
        em.persist(title);
        em.persist(discussion);
        em.getTransaction().commit();
        return discussion;
    }

    private CommentEntity comment(DiscussionEntity discussion, UUID userId, String body) {
        var comment = new CommentEntity(UUID.randomUUID(), discussion, "Anonymous reader", body);
        comment.setUserId(userId);
        return comment;
    }

    private void persist(Object entity) {
        em.getTransaction().begin();
        em.persist(entity);
        em.getTransaction().commit();
    }

    private long commentsCount() {
        return em.createQuery("select count(c) from CommentEntity c", Long.class).getSingleResult();
    }
}
