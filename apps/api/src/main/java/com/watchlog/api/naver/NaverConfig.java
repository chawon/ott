package com.watchlog.api.naver;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(NaverProperties.class)
public class NaverConfig {

    @Bean
    RestClient naverRestClient(NaverProperties props) {
        return RestClient.builder()
                .baseUrl(props.baseUrl())
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("X-Naver-Client-Id", props.clientId())
                .defaultHeader("X-Naver-Client-Secret", props.clientSecret())
                .build();
    }
}
