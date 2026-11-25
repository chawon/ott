package com.watchlog.api.service;

import com.watchlog.api.domain.Status;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.dto.*;
import com.watchlog.api.repo.TitleRepository;
import com.watchlog.api.repo.WatchLogHistoryRepository;
import com.watchlog.api.repo.WatchLogRepository;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.Mockito.*;

/** Actual migrated PostgreSQL, JPA repositories, SyncService and history path. No production data. */
class SyncDeliveryDatabaseTest {
    static PostgreSQLContainer container;
    static DriverManagerDataSource admin;
    static DriverManagerDataSource dataSource;
    static LocalContainerEntityManagerFactoryBean factory;
    static TransactionTemplate tx;
    static JdbcTemplate jdbc;
    static SyncService sync;
    static WatchLogRepository logs;
    static TitleRepository titles;
    static WatchLogHistoryService history;
    static final String SCHEMA = "sync_test_" + UUID.randomUUID().toString().replace("-", "");
    static final OffsetDateTime OLD = OffsetDateTime.parse("2020-01-01T12:00:00Z");
    UUID user = UUID.randomUUID();
    UUID a = UUID.randomUUID();
    UUID b = UUID.randomUUID();

    @BeforeAll
    static void openDatabase() {
        String url = System.getenv("SYNC_TEST_JDBC_URL");
        if (url == null || url.isBlank()) {
            assumeTrue(DockerClientFactory.instance().isDockerAvailable(), "Requires Docker or disposable SYNC_TEST_JDBC_URL");
            container = new PostgreSQLContainer("postgres:16-alpine");
            container.start();
            admin = new DriverManagerDataSource(container.getJdbcUrl(), container.getUsername(), container.getPassword());
        } else {
            admin = new DriverManagerDataSource(url, System.getenv().getOrDefault("SYNC_TEST_DB_USER", "ergate23"), "");
        }
        new JdbcTemplate(admin).execute("create schema " + SCHEMA);
        dataSource = new DriverManagerDataSource(admin.getUrl(), admin.getUsername(), admin.getPassword());
        var props = new Properties();
        props.setProperty("currentSchema", SCHEMA);
        props.setProperty("ApplicationName", SCHEMA);
        dataSource.setConnectionProperties(props);
        jdbc = new JdbcTemplate(dataSource);
        assertThat(jdbc.queryForObject("select current_schema()", String.class)).isEqualTo(SCHEMA);
        Flyway.configure().dataSource(dataSource).schemas(SCHEMA).defaultSchema(SCHEMA).load().migrate();
        factory = new LocalContainerEntityManagerFactoryBean();
        factory.setDataSource(dataSource);
        factory.setPackagesToScan("com.watchlog.api.domain");
        factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "validate",
                "hibernate.physical_naming_strategy", "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
        factory.afterPropertiesSet();
        var manager = new JpaTransactionManager(factory.getObject());
        manager.setDataSource(dataSource);
        tx = new TransactionTemplate(manager);
        var entityManager = SharedEntityManagerCreator.createSharedEntityManager(factory.getObject());
        var repos = new JpaRepositoryFactory(entityManager);
        titles = repos.getRepository(TitleRepository.class);
        logs = repos.getRepository(WatchLogRepository.class);
        history = new WatchLogHistoryService(repos.getRepository(WatchLogHistoryRepository.class));
        sync = new SyncService(titles, logs, history, null, new SyncDeliveryStore(jdbc));
    }

    @AfterAll
    static void closeDatabase() {
        if (factory != null) factory.destroy();
        if (admin != null) new JdbcTemplate(admin).execute("drop schema " + SCHEMA + " cascade");
        if (container != null) container.stop();
    }

    @BeforeEach
    void createPairedDevices() {
        jdbc.update("insert into users(id,pairing_code) values (?,?)", user, UUID.randomUUID().toString().substring(0, 16));
        jdbc.update("insert into user_devices(id,user_id) values (?,?),(?,?)", a, user, b, user);
    }

    @Test
    void deviceWithAnAdvancedLegacyCursorReceivesAnOlderRestoredLogAndTitle() {
        var baseline = tx.execute(status -> sync.pull(null, user, b)).serverTime();
        var cursor = tx.execute(status -> sync.pull(baseline, user, b)).serverTime();
        var title = UUID.randomUUID();
        var log = UUID.randomUUID();
        var titlePayload = new SyncTitlePayload(TitleType.movie, "Isolated restored title", null, null, null, null,
                null, null, null, null, null, null, null, "LOCAL", title.toString());
        var logPayload = new SyncLogPayload(title, Status.DONE, null, "Restored local note", false, null,
                null, null, null, null, null, OLD, null, null);
        var request = new SyncPushRequest(user, a.toString(), OLD, new SyncChanges(
                List.of(new SyncChange<>(log, "upsert", OLD, logPayload)),
                List.of(new SyncChange<>(title, "upsert", OLD, titlePayload))));
        assertThat(tx.execute(status -> sync.push(request, "en")).accepted()).contains(title, log);
        var checkpoint = cursor;
        var delta = tx.execute(status -> sync.pull(checkpoint, user, b));
        assertThat(delta.changes().logs()).extracting(SyncLogDto::id).contains(log);
        assertThat(delta.changes().titles()).extracting(SyncTitleDto::id).contains(title);
        assertThat(delta.changes().logs().stream().filter(row -> row.id().equals(log)).findFirst().orElseThrow().updatedAt())
                .isEqualTo(OLD);
    }

    @Test
    void oldUpdatesAndBothDeletionSignalsTravelWithoutChangingTheirLogicalVersions() {
        var row = restore(OLD, "first");
        var cursor = readyCursor();
        assertThat(pushLog(row, OLD.plusDays(1), "edited").accepted()).contains(row.log());
        var edited = pull(cursor);
        assertThat(edited.changes().logs()).filteredOn(r -> r.id().equals(row.log()))
                .singleElement().satisfies(r -> {
                    assertThat(r.note()).isEqualTo("edited");
                    assertThat(r.updatedAt()).isEqualTo(OLD.plusDays(1));
                });
        var deletion = OLD.plusDays(2);
        var request = new SyncPushRequest(user, a.toString(), deletion, new SyncChanges(
                List.of(new SyncChange<>(row.log(), "delete", deletion, null)),
                List.of(new SyncChange<>(row.title(), "delete", deletion, null))));
        assertThat(tx.execute(status -> sync.push(request, "ko")).accepted()).contains(row.log(), row.title());
        var deleted = pull(edited.serverTime());
        assertThat(deleted.changes().logs()).filteredOn(r -> r.id().equals(row.log())).singleElement()
                .satisfies(r -> assertThat(r.deletedAt()).isEqualTo(deletion));
        assertThat(deleted.changes().titles()).filteredOn(r -> r.id().equals(row.title())).singleElement()
                .satisfies(r -> assertThat(r.deletedAt()).isEqualTo(deletion));
        assertThat(tx.execute(status -> sync.push(request, "ko")).accepted()).contains(row.log(), row.title());
        assertThat(pull(deleted.serverTime()).changes().logs()).isEmpty();
    }

    @Test
    void unchangedTitleIsIncludedWithAnOldLogAndNonSyncMetadataWritesAreCaptured() {
        var row = restore(OLD, "first");
        var cursor = readyCursor();
        pushLog(row, OLD.plusDays(1), "changed log only");
        var changed = pull(cursor);
        assertThat(changed.changes().titles()).extracting(SyncTitleDto::id).contains(row.title());
        jdbc.update("update titles set name = 'Metadata updated without logical clock rewrite' where id = ?", row.title());
        var metadata = pull(changed.serverTime());
        assertThat(metadata.changes().titles()).filteredOn(r -> r.id().equals(row.title())).singleElement()
                .satisfies(r -> assertThat(r.name()).isEqualTo("Metadata updated without logical clock rewrite"));
        assertThat(jdbc.queryForObject("select updated_at from titles where id = ?", OffsetDateTime.class, row.title())).isEqualTo(OLD);
    }

    @Test
    void lostResponseRetryReplaysTheChangeAndTheAcknowledgedCursorThenReturnsEmpty() {
        var row = restore(OLD, "first");
        var cursor = readyCursor();
        pushLog(row, OLD.plusDays(1), "must replay");
        var first = pull(cursor);
        long histories = jdbc.queryForObject("select count(*) from watch_log_history where log_id = ?", Long.class, row.log());
        var retry = pull(cursor); // Its response was not applied, so the old cursor must not acknowledge it.
        assertThat(first.changes().logs()).extracting(SyncLogDto::id).contains(row.log());
        assertThat(retry.changes().logs()).extracting(SyncLogDto::id).contains(row.log());
        assertThat(jdbc.queryForObject("select count(*) from watch_log_history where log_id = ?", Long.class, row.log())).isEqualTo(histories);
        var next = pull(retry.serverTime());
        assertThat(next.changes().logs()).isEmpty();
        assertThat(next.changes().titles()).isEmpty();
    }

    @Test
    void futureClientVersionsDoNotRepeatForeverAndNewerRemoteEditStillWins() {
        var row = restore(OLD, "first");
        var cursor = readyCursor();
        var future = OffsetDateTime.parse("2040-01-01T00:00:00Z");
        pushLog(row, future, "future remote edit");
        jdbc.update("update titles set updated_at = ? where id = ?",future,row.title());
        var changed = pull(cursor);
        assertThat(changed.changes().logs()).filteredOn(r -> r.id().equals(row.log())).singleElement()
                .satisfies(r -> assertThat(r.updatedAt()).isEqualTo(future));
        assertThat(pushLog(row, OLD.plusDays(1), "older recovery").rejected()).extracting(SyncReject::reason).contains("stale");
        var next = pull(changed.serverTime());
        assertThat(next.changes().logs()).isEmpty();
        assertThat(next.changes().titles()).isEmpty();
        assertThat(jdbc.queryForObject("select note from watch_logs where id = ?", String.class, row.log())).isEqualTo("future remote edit");
    }

    @Test
    void exactPushReplayDoesNotDuplicateHistoryOrReceiptsAndAnEqualConflictKeepsRemote() {
        var at = OLD.withNano(123456789);
        var row = restore(at, "committed version");
        var cursor = readyCursor();
        long histories = jdbc.queryForObject("select count(*) from watch_log_history where log_id = ?", Long.class, row.log());
        assertThat(pushLog(row, at, "committed version").accepted()).contains(row.log());
        assertThat(pushLog(row, at, "different equal-time version").rejected()).extracting(SyncReject::reason).contains("stale");
        assertThat(jdbc.queryForObject("select count(*) from watch_log_history where log_id = ?", Long.class, row.log())).isEqualTo(histories);
        assertThat(jdbc.queryForObject("select note from watch_logs where id = ?", String.class, row.log())).isEqualTo("committed version");
        assertThat(pull(cursor).changes().logs()).isEmpty();
    }

    @Test
    void canonicalDuplicateReplayKeepsOneRowAndDoesNotAppendHistory() {
        var row = restore(OLD, "same record");
        long histories = jdbc.queryForObject("select count(*) from watch_log_history where log_id = ?", Long.class, row.log());
        var alias = UUID.randomUUID();
        var request = new SyncPushRequest(user, a.toString(), OLD, new SyncChanges(
                List.of(new SyncChange<>(alias, "upsert", OLD, payload(row.title(), "same record"))), List.of()));
        assertThat(tx.execute(status -> sync.push(request, "ko")).accepted()).contains(alias);
        assertThat(jdbc.queryForObject("select count(*) from watch_logs where user_id = ? and title_id = ?", Integer.class, user, row.title())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from watch_log_history where log_id = ?", Long.class, row.log())).isEqualTo(histories);
    }

    @Test
    void aCommitAfterTheReadersCheckpointIsPublishedLaterEvenIfItsSequenceWasAllocatedFirst() throws Exception {
        var cursor = readyCursor();
        var slowTitle = UUID.randomUUID();
        var slowLog = UUID.randomUUID();
        try (var slow = dataSource.getConnection()) {
            slow.setAutoCommit(false);
            try (var statement = slow.createStatement()) {
                statement.execute("insert into titles(id,type,name,updated_at) values ('"+slowTitle+"','movie','Slow isolated title','2020-01-01Z')");
                statement.execute("insert into watch_logs(id,title_id,user_id,status,watched_at,updated_at) values ('"+slowLog+"','"+slowTitle+"','"+user+"','DONE','2020-01-01Z','2020-01-01Z')");
            }
            var later = restore(OLD, "commits first");
            var observed = pull(cursor);
            assertThat(observed.changes().logs()).extracting(SyncLogDto::id).contains(later.log()).doesNotContain(slowLog);
            slow.commit();
            var delivered = pull(observed.serverTime());
            assertThat(delivered.changes().logs()).extracting(SyncLogDto::id).contains(slowLog);
            assertThat(delivered.changes().titles()).extracting(SyncTitleDto::id).contains(slowTitle);
            assertThat(pull(delivered.serverTime()).changes().logs()).isEmpty();
        }
    }

    @Test
    void aRolledBackWriteLeavesNeitherPayloadNorPendingReceipt() throws Exception {
        var cursor = readyCursor();
        var title = UUID.randomUUID();
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try (var statement = connection.createStatement()) {
                statement.execute("insert into titles(id,type,name,updated_at) values ('"+title+"','movie','Must roll back','2020-01-01Z')");
            }
            connection.rollback();
        }
        var next = pull(cursor);
        assertThat(next.changes().titles()).extracting(SyncTitleDto::id).doesNotContain(title);
        assertThat(jdbc.queryForObject("select count(*) from sync_pending_changes where entity_id = ?", Integer.class, title)).isZero();
    }

    @Test
    void rolledBackPublicationCannotAcknowledgeOrLoseThePendingChange() {
        var row = restore(OLD,"first");
        var cursor = readyCursor();
        pushLog(row,OLD.plusDays(1),"must survive reader rollback");
        tx.execute(status -> {
            var response = sync.pull(cursor,user,b);
            assertThat(response.changes().logs()).extracting(SyncLogDto::id).contains(row.log());
            status.setRollbackOnly();
            return response;
        });
        assertThat(jdbc.queryForObject("select count(*) from sync_pending_changes where entity_id = ?",Integer.class,row.log())).isPositive();
        var retried = pull(cursor);
        assertThat(retried.changes().logs()).extracting(SyncLogDto::id).contains(row.log());
        assertThat(pull(retried.serverTime()).changes().logs()).isEmpty();
    }

    @Test
    void physicalAccountCleanupAlsoRemovesCursorAndLogDeliveryMetadata() {
        var row = restore(OLD,"private fixture");
        readyCursor();
        jdbc.update("delete from watch_logs where user_id = ?",user);
        jdbc.update("delete from user_devices where user_id = ?",user);
        jdbc.update("delete from users where id = ?",user);
        assertThat(jdbc.queryForObject("select count(*) from sync_device_cursors where user_id = ?",Integer.class,user)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from sync_deliveries where entity_type = 'log' and entity_id = ?",Integer.class,row.log())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from sync_pending_changes where entity_id = ?",Integer.class,row.log())).isZero();
    }

    @Test
    void upgradingV32RepairsAPreviouslyMissedLegacyCursorWithoutRewritingUserTimestamps() {
        String upgradeSchema = "sync_upgrade_"+UUID.randomUUID().toString().replace("-","");
        new JdbcTemplate(admin).execute("create schema "+upgradeSchema);
        var upgrade = new DriverManagerDataSource(admin.getUrl(),admin.getUsername(),admin.getPassword());
        var properties = new Properties();
        properties.setProperty("currentSchema",upgradeSchema);
        upgrade.setConnectionProperties(properties);
        var sql = new JdbcTemplate(upgrade);
        LocalContainerEntityManagerFactoryBean upgradeFactory = null;
        try {
            Flyway.configure().dataSource(upgrade).schemas(upgradeSchema).defaultSchema(upgradeSchema).target("32").load().migrate();
            var owner = UUID.randomUUID();var device = UUID.randomUUID();var title = UUID.randomUUID();var log = UUID.randomUUID();
            sql.update("insert into users(id,pairing_code) values (?,?)",owner,owner.toString().substring(0,16));
            sql.update("insert into user_devices(id,user_id) values (?,?)",device,owner);
            sql.update("insert into titles(id,type,name,updated_at) values (?,'movie','Missed before V33',?)",title,OLD);
            sql.update("insert into watch_logs(id,title_id,user_id,status,watched_at,updated_at) values (?,?,?,'DONE',?,?)",log,title,owner,OLD,OLD);
            var legacyCursor = OffsetDateTime.now();
            assertThat(sql.queryForObject("select count(*) from watch_logs where updated_at > ?",Integer.class,legacyCursor)).isZero();
            Flyway.configure().dataSource(upgrade).schemas(upgradeSchema).defaultSchema(upgradeSchema).load().migrate();
            assertThat(sql.queryForObject("select updated_at from watch_logs where id = ?",OffsetDateTime.class,log)).isEqualTo(OLD);
            assertThat(sql.queryForObject("select count(*) from sync_pending_changes",Integer.class)).isZero();
            upgradeFactory = new LocalContainerEntityManagerFactoryBean();
            upgradeFactory.setDataSource(upgrade);
            upgradeFactory.setPackagesToScan("com.watchlog.api.domain");
            upgradeFactory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
            upgradeFactory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto","validate",
                    "hibernate.physical_naming_strategy","org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
            upgradeFactory.afterPropertiesSet();
            var manager = new JpaTransactionManager(upgradeFactory.getObject());manager.setDataSource(upgrade);
            var transaction = new TransactionTemplate(manager);
            var repositoryFactory = new JpaRepositoryFactory(SharedEntityManagerCreator.createSharedEntityManager(upgradeFactory.getObject()));
            var service = new SyncService(repositoryFactory.getRepository(TitleRepository.class),repositoryFactory.getRepository(WatchLogRepository.class),
                    new WatchLogHistoryService(repositoryFactory.getRepository(WatchLogHistoryRepository.class)),null,new SyncDeliveryStore(sql));
            var repaired = transaction.execute(status -> service.pull(legacyCursor,owner,device));
            assertThat(repaired.changes().logs()).extracting(SyncLogDto::id).containsExactly(log);
            assertThat(repaired.changes().titles()).extracting(SyncTitleDto::id).contains(title);
            assertThat(transaction.execute(status -> service.pull(repaired.serverTime(),owner,device)).changes().logs()).isEmpty();
            assertThat(sql.queryForObject("select count(*) from watch_log_history",Integer.class)).isZero();
        } finally {
            if (upgradeFactory != null) upgradeFactory.destroy();
            new JdbcTemplate(admin).execute("drop schema "+upgradeSchema+" cascade");
        }
    }

    @Test
    void cursorIssuedByTheOldImageAfterBootstrapForcesRepairInsteadOfSkippingPublishedChanges() {
        var row = restore(OLD, "first");
        readyCursor();
        pushLog(row, OLD.plusDays(1), "changed while old image exists");
        tx.execute(status -> sync.pull(null, user, a)); // Another new-image client publishes first.
        var oldImageCursor = jdbc.queryForObject("select clock_timestamp() + interval '1 minute'", OffsetDateTime.class);
        assertThat(jdbc.queryForObject("select count(*) from watch_logs where id = ? and updated_at > ?", Integer.class, row.log(), oldImageCursor)).isZero();
        var repaired = pull(oldImageCursor);
        assertThat(repaired.changes().logs()).filteredOn(r -> r.id().equals(row.log())).singleElement()
                .satisfies(r -> assertThat(r.note()).isEqualTo("changed while old image exists"));
        assertThat(pull(repaired.serverTime()).changes().logs()).isEmpty();
    }

    @Test
    void moreThan250ChangesAtOnePublicationBoundaryAreCompleteThenEmpty() {
        var cursor = readyCursor();
        jdbc.update("""
                insert into titles(id,type,name,updated_at)
                select md5(cast(? as text)||'.title.'||i)::uuid,'movie','Boundary '||i,'2020-01-01Z'::timestamptz
                from generate_series(1,251) i
                """, user);
        jdbc.update("""
                insert into watch_logs(id,title_id,user_id,status,watched_at,updated_at)
                select md5(cast(? as text)||'.log.'||i)::uuid,md5(cast(? as text)||'.title.'||i)::uuid,
                       cast(? as uuid),'DONE','2020-01-01Z'::timestamptz,'2020-01-01Z'::timestamptz
                from generate_series(1,251) i
                """, user,user,user);
        var all = pull(cursor);
        assertThat(all.changes().logs()).hasSize(251);
        assertThat(all.changes().logs()).extracting(SyncLogDto::id).doesNotHaveDuplicates();
        var next = pull(all.serverTime());
        assertThat(next.changes().logs()).isEmpty();
        assertThat(next.changes().titles()).isEmpty();
    }

    @Test
    void restLogServiceAndBulkOwnershipChangesUseTheSameJournalWithoutRewritingLogicalTime() throws Exception {
        var title = tx.execute(status -> new TitleService(titles, null).createIfNeeded(TitleType.movie,"REST isolated",null,null));
        var cursor = readyCursor();
        var request = new tools.jackson.databind.ObjectMapper().readValue(
                "{\"titleId\":\""+title.getId()+"\",\"status\":\"DONE\",\"note\":\"REST service\"}", CreateWatchLogRequest.class);
        var logService = new LogService(logs,new TitleService(titles,null),history);
        var log = tx.execute(status -> logService.create(request,user,"ko"));
        var next = pull(cursor);
        assertThat(next.changes().logs()).extracting(SyncLogDto::id).contains(log.getId());
        var previousLogical = log.getUpdatedAt();
        // This is the same SQL-only ownership change used by the existing merge/orphan paths.
        jdbc.update("update watch_logs set user_id = null where id = ?",log.getId());
        jdbc.update("update watch_logs set user_id = ? where id = ?",user,log.getId());
        var moved = pull(next.serverTime());
        assertThat(moved.changes().logs()).extracting(SyncLogDto::id).contains(log.getId());
        assertThat(jdbc.queryForObject("select updated_at from watch_logs where id = ?",OffsetDateTime.class,log.getId()).toInstant())
                .isEqualTo(previousLogical.toInstant().truncatedTo(java.time.temporal.ChronoUnit.MICROS).plusNanos(
                        previousLogical.getNano()%1000>=500 ? 1000 : 0));
    }

    @Test
    void simultaneousSyncPushesCompareAgainstTheCommittedNewerVersion() throws Exception {
        var row = restore(OLD,"first");
        var written = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var newer = pool.submit(() -> tx.execute(status -> {
                var result = sync.push(logRequest(row,OLD.plusDays(3),"newer committed edit"),"ko");
                logs.flush();
                written.countDown();
                try { assertThat(release.await(10,TimeUnit.SECONDS)).isTrue(); }
                catch (InterruptedException error) { throw new RuntimeException(error); }
                return result;
            }));
            assertThat(written.await(10,TimeUnit.SECONDS)).isTrue();
            var older = pool.submit(() -> tx.execute(status -> sync.push(logRequest(row,OLD.plusDays(1),"older racing edit"),"ko")));
            try {
                boolean blocked = false;
                for (int i=0;i<100;i++) {
                    blocked = jdbc.queryForObject("select count(*) from pg_stat_activity where application_name = ? and wait_event_type = 'Lock'",Integer.class,SCHEMA)>0;
                    if (blocked) break;
                    Thread.sleep(20);
                }
                assertThat(blocked).isTrue();
            } finally { release.countDown(); }
            assertThat(newer.get(10,TimeUnit.SECONDS).accepted()).contains(row.log());
            assertThat(older.get(10,TimeUnit.SECONDS).rejected()).extracting(SyncReject::reason).contains("stale");
        } finally { release.countDown(); }
        assertThat(jdbc.queryForObject("select note from watch_logs where id = ?",String.class,row.log())).isEqualTo("newer committed edit");
    }

    @Test
    void originalTitleRequestIsAnIdempotentReplayAfterTmdbHydratedItsMetadata() {
        var tmdb = mock(com.watchlog.api.tmdb.TmdbClient.class);
        var title = UUID.randomUUID();
        String provider = "isolated-"+title;
        when(tmdb.fetchDetails(TitleType.movie,provider,"ko")).thenReturn(new com.watchlog.api.tmdb.TmdbClient.Snapshot(
                TitleType.movie,"Hydrated name",2026,"Hydrated overview","https://images.invalid/poster",List.of("Drama"),List.of("Director"),List.of("Cast")));
        var service = new SyncService(titles,logs,history,tmdb,new SyncDeliveryStore(jdbc));
        var payload = new SyncTitlePayload(TitleType.movie,"Original offline name",2000,null,null,null,
                "Original overview",null,null,null,null,null,null,"TMDB",provider);
        var request = new SyncPushRequest(user,a.toString(),OLD,new SyncChanges(List.of(),
                List.of(new SyncChange<>(title,"upsert",OLD,payload))));
        assertThat(tx.execute(status -> service.push(request,"ko")).accepted()).contains(title);
        readyCursor();
        assertThat(tx.execute(status -> service.push(request,"ko")).accepted()).contains(title);
        assertThat(jdbc.queryForObject("select name from titles where id = ?",String.class,title)).isEqualTo("Hydrated name");
        assertThat(jdbc.queryForObject("select year from titles where id = ?",Integer.class,title)).isEqualTo(2026);
        assertThat(jdbc.queryForObject("select overview from titles where id = ?",String.class,title)).isEqualTo("Hydrated overview");
        assertThat(jdbc.queryForObject("select count(*) from sync_pending_changes where entity_id = ?",Integer.class,title)).isZero();
        verify(tmdb,times(1)).fetchDetails(TitleType.movie,provider,"ko");
    }

    @Test
    void networkHydrationForOneAccountDoesNotLockUnrelatedAccountsCatalogPush() throws Exception {
        var tmdb = mock(com.watchlog.api.tmdb.TmdbClient.class);
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        String provider = "isolated-network-"+UUID.randomUUID();
        when(tmdb.fetchDetails(TitleType.movie,provider,"ko")).thenAnswer(invocation -> {
            entered.countDown();
            assertThat(release.await(10,TimeUnit.SECONDS)).isTrue();
            return new com.watchlog.api.tmdb.TmdbClient.Snapshot(TitleType.movie,"Hydrated",2026,null,null,null,List.of("Director"),null);
        });
        var service = new SyncService(titles,logs,history,tmdb,new SyncDeliveryStore(jdbc));
        var title = UUID.randomUUID();
        var request = new SyncPushRequest(user,a.toString(),OLD,new SyncChanges(List.of(),
                List.of(new SyncChange<>(title,"upsert",OLD,new SyncTitlePayload(TitleType.movie,"Waiting",null,null,null,null,
                        null,null,null,null,null,null,null,"TMDB",provider)))));
        UUID other = UUID.randomUUID();
        jdbc.update("insert into users(id,pairing_code) values (?,?)",other,other.toString().substring(0,16));
        try (var pool = Executors.newFixedThreadPool(2)) {
            var waiting = pool.submit(() -> tx.execute(status -> service.push(request,"ko")));
            assertThat(entered.await(10,TimeUnit.SECONDS)).isTrue();
            var otherId = UUID.randomUUID();
            var otherRequest = new SyncPushRequest(other,null,OLD,new SyncChanges(List.of(),
                    List.of(new SyncChange<>(otherId,"upsert",OLD,new SyncTitlePayload(TitleType.movie,"Unrelated",null,null,null,null,
                            null,null,null,null,null,null,null,"LOCAL",otherId.toString())))));
            try {
                var independent = pool.submit(() -> tx.execute(status -> sync.push(otherRequest,"ko")));
                assertThat(independent.get(2,TimeUnit.SECONDS).accepted()).contains(otherId);
            } finally { release.countDown(); }
            assertThat(waiting.get(10,TimeUnit.SECONDS).accepted()).contains(title);
        } finally { release.countDown(); }
    }

    private SyncPullResponse pull(OffsetDateTime cursor) {
        return tx.execute(status -> sync.pull(cursor,user,b));
    }

    private OffsetDateTime readyCursor() {
        return pull(pull(null).serverTime()).serverTime();
    }

    private Row restore(OffsetDateTime at,String note) {
        var row = new Row(UUID.randomUUID(),UUID.randomUUID());
        var titlePayload = new SyncTitlePayload(TitleType.movie,"Isolated "+row.title(),null,null,null,null,
                null,null,null,null,null,null,null,"LOCAL",row.title().toString());
        var request = new SyncPushRequest(user,a.toString(),at,new SyncChanges(
                List.of(new SyncChange<>(row.log(),"upsert",at,payload(row.title(),note))),
                List.of(new SyncChange<>(row.title(),"upsert",at,titlePayload))));
        assertThat(tx.execute(status -> sync.push(request,"ko")).accepted()).contains(row.title(),row.log());
        return row;
    }

    private SyncPushResponse pushLog(Row row,OffsetDateTime at,String note) {
        return tx.execute(status -> sync.push(logRequest(row,at,note),"ko"));
    }

    private SyncPushRequest logRequest(Row row,OffsetDateTime at,String note) {
        return new SyncPushRequest(user,a.toString(),at,new SyncChanges(
                List.of(new SyncChange<>(row.log(),"upsert",at,payload(row.title(),note))),List.of()));
    }

    private SyncLogPayload payload(UUID title,String note) {
        return new SyncLogPayload(title,Status.DONE,null,note,false,null,null,null,null,null,null,OLD,null,null);
    }

    private record Row(UUID title,UUID log) {}
}
