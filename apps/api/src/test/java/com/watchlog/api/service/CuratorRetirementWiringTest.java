package com.watchlog.api.service;

import com.watchlog.api.notify.TelegramConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

import static org.assertj.core.api.Assertions.assertThat;

class CuratorRetirementWiringTest {
    @Test
    void obsoleteEnableFlagCannotRestoreTheCuratorScheduler() {
        new ApplicationContextRunner().withUserConfiguration(TelegramConfig.class)
                .withPropertyValues("curator.automation.enabled=true", "notify.telegram.enabled=true",
                        "notify.telegram.bot-token=test-token", "notify.telegram.chat-id=test-chat")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasBean("telegramRestClient").hasBean("taskScheduler")
                            .doesNotHaveBean("curatorTaskScheduler").doesNotHaveBean("curatorAutomationService");
                    assertThat(context.getBeansOfType(ThreadPoolTaskScheduler.class)).containsOnlyKeys("taskScheduler");
                });
    }
}
