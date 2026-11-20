package com.watchlog.api.tmdb;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.ResourceAccessException;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TmdbConfigTest {

    @Test
    void configuresConnectAndReadTimeoutsOnTmdbRestClient() throws Exception {
        assertThat(TmdbConfig.CONNECT_TIMEOUT).isEqualTo(Duration.ofSeconds(3));
        assertThat(TmdbConfig.READ_TIMEOUT).isEqualTo(Duration.ofSeconds(5));

        var release = new CountDownLatch(1);
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/search/multi", exchange -> {
            try {
                release.await(5, TimeUnit.SECONDS);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
            byte[] body = "{\"results\":[]}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (var out = exchange.getResponseBody()) { out.write(body); }
        });
        server.start();
        try {
            var props = new TmdbProperties("http://127.0.0.1:" + server.getAddress().getPort(), "test-token", "ko-KR", "w342");
            var rest = new TmdbConfig().tmdbRestClient(props, Duration.ofSeconds(1), Duration.ofMillis(120));
            var client = new TmdbClient(rest, props);
            assertThatThrownBy(() -> client.searchMulti("Interstellar", "ko"))
                    .isInstanceOf(ResourceAccessException.class);
        } finally {
            release.countDown();
            server.stop(0);
        }
    }
}
