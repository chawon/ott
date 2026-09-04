package com.watchlog.api.service;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.jackson.autoconfigure.JacksonAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.assertj.core.api.Assertions.assertThat;
class CuratedContentAdminContextTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(JacksonAutoConfiguration.class))
            .withPropertyValues("admin.curated-content.token=test-admin-token")
            .withBean(JdbcTemplate.class, () -> new JdbcTemplate(new DriverManagerDataSource()))
            .withUserConfiguration(CuratedPromptGenerator.class, CuratedContentAdminService.class);

    @Test
    void curatorAdminServiceUsesTheSpringBoot4JacksonBean() {
        contextRunner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasSingleBean(tools.jackson.databind.ObjectMapper.class);
            assertThat(context).hasSingleBean(CuratedContentAdminService.class);
        });
    }
}
