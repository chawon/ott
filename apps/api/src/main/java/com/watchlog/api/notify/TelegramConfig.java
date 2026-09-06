package com.watchlog.api.notify;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties({TelegramProperties.class, CuratorAutomationProperties.class})
public class TelegramConfig {

    @Bean
    org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler taskScheduler() {
        // Preserve the existing single-thread scheduler for reports and other application jobs.
        return new org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler();
    }

    @Bean
    org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler curatorTaskScheduler() {
        var scheduler = new org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("curator-");
        return scheduler;
    }

    @Bean
    RestClient telegramRestClient(TelegramProperties props) {
        return RestClient.builder()
                .baseUrl(props.baseUrl())
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }
}
