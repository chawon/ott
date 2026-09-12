package com.watchlog.api.kakao;

import com.watchlog.api.book.BookIsbn;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class KakaoBookClientTest {
    @Test
    void productionHttpClientEncodesQueryOnceAndUsesTheAuthHeader() throws Exception {
        var query = new AtomicReference<String>();
        var auth = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v3/search/book", exchange -> {
            query.set(exchange.getRequestURI().getRawQuery());
            auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] body = "{\"documents\":[]}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (var out = exchange.getResponseBody()) { out.write(body); }
        });
        server.start();
        try {
            var props = new KakaoProperties("http://127.0.0.1:" + server.getAddress().getPort(), "test-key");
            var client = new KakaoBookClient(new KakaoConfig().kakaoRestClient(props), props);
            assertThat(client.search(" 해리 & C++ {book} ")).isEmpty();
            assertThat(query.get()).isEqualTo("query=%ED%95%B4%EB%A6%AC%20%26%20C%2B%2B%20%7Bbook%7D&size=10&page=1");
            assertThat(auth.get()).isEqualTo("KakaoAK test-key");
        } finally { server.stop(0); }
    }

    @Test
    void handlesMissingMetadataAndKeepsStableIdsWithoutAnIsbn() {
        var builder = RestClient.builder().baseUrl("https://dapi.kakao.com");
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(anything()).andRespond(withSuccess("""
                {"documents":[null, {"title":" "}, {"title":"Unidentifiable"},
                {"title":"A &amp; B", "url":"https://example.com/book", "isbn":"invalid",
                 "datetime":"bad-date", "authors":[null,"<b>A</b>","B"],"thumbnail":""}]}
                """, MediaType.APPLICATION_JSON));
        var client = new KakaoBookClient(builder.build(), new KakaoProperties(null, "test-key"));
        assertThat(client.search("book")).singleElement().satisfies(book -> {
            assertThat(book.name()).isEqualTo("A & B");
            assertThat(book.author()).isEqualTo("A, B");
            assertThat(book.providerId()).hasSize(40).matches("[0-9a-f]+");
            assertThat(book.isbn13()).isNull();
            assertThat(book.pubdate()).isNull();
            assertThat(book.posterUrl()).isNull();
        });
    }

    @Test
    void rejectsMissingCredentialsButAllowsBlankQueries() {
        var client = new KakaoBookClient(RestClient.create(), new KakaoProperties(null, null));
        assertThat(client.search(" ")).isEmpty();
        assertThatThrownBy(() -> client.search("book"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }

    @Test
    void mapsUpstreamFailuresWithoutLeakingResponseDetails() {
        for (var status : new HttpStatus[]{HttpStatus.UNAUTHORIZED, HttpStatus.TOO_MANY_REQUESTS, HttpStatus.INTERNAL_SERVER_ERROR}) {
            var builder = RestClient.builder().baseUrl("https://dapi.kakao.com");
            var server = MockRestServiceServer.bindTo(builder).build();
            server.expect(anything()).andRespond(withStatus(status).body("sensitive upstream body"));
            var client = new KakaoBookClient(builder.build(), new KakaoProperties(null, "test-key"));
            assertThatThrownBy(() -> client.search("book"))
                    .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                        assertThat(e.getStatusCode()).isEqualTo(status == HttpStatus.TOO_MANY_REQUESTS
                                ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_GATEWAY);
                        assertThat(e).hasNoCause().hasMessageNotContaining("sensitive").hasMessageNotContaining("test-key");
                    });
        }
    }

    @Test
    void rejectsMalformedOrMissingDocumentsInsteadOfClaimingNoResults() {
        for (String body : new String[]{"{}", "null", "{bad-json"}) {
            var builder = RestClient.builder().baseUrl("https://dapi.kakao.com");
            var server = MockRestServiceServer.bindTo(builder).build();
            server.expect(anything()).andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
            var client = new KakaoBookClient(builder.build(), new KakaoProperties(null, "test-key"));
            assertThatThrownBy(() -> client.search("book"))
                    .isInstanceOfSatisfying(ResponseStatusException.class,
                            e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY));
        }
    }

    @Test
    void validatesAndNormalizesEditionIdentifiers() {
        assertThat(BookIsbn.parse("8983921986")).isEqualTo(new BookIsbn("8983921986", "9788983921987"));
        assertThat(BookIsbn.parse("978-89-8392-198-7")).isEqualTo(BookIsbn.parse("8983921986"));
        assertThat(BookIsbn.parse("1186745622 9791186745625"))
                .isEqualTo(new BookIsbn(null, "9791186745625"));
        assertThat(BookIsbn.parse("9788983921988")).isEqualTo(new BookIsbn(null, null));
    }
}
