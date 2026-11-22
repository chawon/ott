package com.watchlog.api.service;

import org.flywaydb.core.Flyway;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.Properties;
import java.util.UUID;

import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** An isolated schema, even when a developer supplies a disposable local PostgreSQL URL. */
final class CuratorTestDatabase implements AutoCloseable {
    private final PostgreSQLContainer container;
    private final DriverManagerDataSource adminDataSource;
    private final String schema = "curator_test_" + UUID.randomUUID().toString().replace("-", "");
    final JdbcTemplate jdbc;

    CuratorTestDatabase() {
        String url = System.getenv("CURATOR_TEST_JDBC_URL");
        if (url == null || url.isBlank()) {
            assumeTrue(DockerClientFactory.instance().isDockerAvailable(),
                    "PostgreSQL test requires Docker or CURATOR_TEST_JDBC_URL");
            container = new PostgreSQLContainer("postgres:16-alpine");
            container.start();
            adminDataSource = new DriverManagerDataSource(container.getJdbcUrl(),
                    container.getUsername(), container.getPassword());
        } else {
            container = null;
            adminDataSource = new DriverManagerDataSource(url,
                    System.getenv().getOrDefault("CURATOR_TEST_DB_USER", "ergate23"), "");
        }
        new JdbcTemplate(adminDataSource).execute("create schema " + schema);
        var dataSource = new DriverManagerDataSource(adminDataSource.getUrl(),
                adminDataSource.getUsername(), adminDataSource.getPassword());
        var properties = new Properties();
        properties.setProperty("currentSchema", schema);
        dataSource.setConnectionProperties(properties);
        jdbc = new JdbcTemplate(dataSource);
        if (!schema.equals(jdbc.queryForObject("select current_schema()", String.class))) {
            close();
            throw new IllegalStateException("Curator test connection did not select its isolated schema");
        }
        Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                .locations("classpath:db/migration").load().migrate();
    }

    @Override
    public void close() {
        try {
            new JdbcTemplate(adminDataSource).execute("drop schema " + schema + " cascade");
        } finally {
            if (container != null) container.stop();
        }
    }
}
