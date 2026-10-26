package com.watchlog.api.googlebooks;

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

class GoogleBooksClientTest {
    @Test
    void productionClientEncodesQueryOnceAndKeepsTheKeyOutOfTheUrl() throws Exception {
        var query = new AtomicReference<String>();
        var key = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/books/v1/volumes", exchange -> {
            query.set(exchange.getRequestURI().getRawQuery());
            key.set(exchange.getRequestHeaders().getFirst("X-Goog-Api-Key"));
            byte[] body = "{\"totalItems\":0}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (var out = exchange.getResponseBody()) { out.write(body); }
        });
        server.start();
        try {
            var props = new GoogleBooksProperties("http://127.0.0.1:" + server.getAddress().getPort(), "test-key");
            var client = new GoogleBooksClient(new GoogleBooksConfig().googleBooksRestClient(props), props);
            assertThat(client.search(" 해리 & C++ {book} ")).isEmpty();
            assertThat(query.get()).isEqualTo("q=%ED%95%B4%EB%A6%AC%20%26%20C%2B%2B%20%7Bbook%7D&langRestrict=en&printType=books&maxResults=10");
            assertThat(key.get()).isEqualTo("test-key");
            assertThat(query.get()).doesNotContain("test-key");
        } finally { server.stop(0); }
    }

    @Test
    void searchesNormalizedIsbnAndAllowsZeroResultsWithoutAnItemsArray() {
        var builder = RestClient.builder().baseUrl("https://www.googleapis.com");
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://www.googleapis.com/books/v1/volumes?q=isbn%3A9780140328721&langRestrict=en&printType=books&maxResults=10"))
                .andRespond(withSuccess("{\"totalItems\":0}", MediaType.APPLICATION_JSON));
        assertThat(new GoogleBooksClient(builder.build(), new GoogleBooksProperties(null, "key"))
                .search("0-14-032872-6")).isEmpty();
        server.verify();
    }

    @Test
    void keepsVolumeIdentityWithoutIsbnAndHandlesMissingOrPartialMetadata() {
        var builder = RestClient.builder().baseUrl("https://www.googleapis.com");
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(anything()).andRespond(withSuccess("""
                {"totalItems":8,"items":[null,{}, {"id":"no-info"},
                {"id":"blank","volumeInfo":{"title":" "}},
                {"id":"no-isbn","volumeInfo":{"title":"<b>A &amp; B</b>",
                 "authors":[null,"<i>A</i>","B"],"publishedDate":"2020",
                 "industryIdentifiers":[{"type":"OTHER","identifier":"9780140328721"}],
                 "imageLinks":{"smallThumbnail":"http://example.com/small.jpg"}}},
                {"id":"month","volumeInfo":{"title":"Month","publishedDate":"2021-02"}},
                {"id":"bad-date","volumeInfo":{"title":"Bad date","publishedDate":"2021-02-30"}},
                {"id":"no-date","volumeInfo":{"title":"No date"}}]}
                """, MediaType.APPLICATION_JSON));
        var books = new GoogleBooksClient(builder.build(), new GoogleBooksProperties(null, "key")).search("book");
        assertThat(books).hasSize(4);
        assertThat(books.getFirst()).satisfies(book -> {
            assertThat(book.providerId()).isEqualTo("no-isbn");
            assertThat(book.name()).isEqualTo("A & B");
            assertThat(book.author()).isEqualTo("A, B");
            assertThat(book.isbn13()).isNull();
            assertThat(book.year()).isEqualTo(2020);
            assertThat(book.pubdate()).isEqualTo("2020");
            assertThat(book.posterUrl()).isEqualTo("https://example.com/small.jpg");
        });
        assertThat(books.get(1).pubdate()).isEqualTo("202102");
        assertThat(books.get(2).pubdate()).isNull();
        assertThat(books.get(3).pubdate()).isNull();
    }

    @Test
    void rejectsMissingCredentialsButAllowsBlankQueries() {
        var client = new GoogleBooksClient(RestClient.create(), new GoogleBooksProperties(null, null));
        assertThat(client.search(" ")).isEmpty();
        assertThatThrownBy(() -> client.search("book"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }

    @Test
    void mapsUpstreamFailuresWithoutLeakingKeyQueryOrResponse() {
        for (var status : new HttpStatus[]{HttpStatus.FORBIDDEN, HttpStatus.TOO_MANY_REQUESTS, HttpStatus.INTERNAL_SERVER_ERROR}) {
            var builder = RestClient.builder().baseUrl("https://www.googleapis.com");
            var server = MockRestServiceServer.bindTo(builder).build();
            server.expect(anything()).andRespond(withStatus(status).body("sensitive upstream body"));
            var client = new GoogleBooksClient(builder.build(), new GoogleBooksProperties(null, "test-key"));
            assertThatThrownBy(() -> client.search("private-query"))
                    .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                        assertThat(error.getStatusCode()).isEqualTo(status == HttpStatus.FORBIDDEN || status == HttpStatus.TOO_MANY_REQUESTS
                                ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_GATEWAY);
                        assertThat(error).hasNoCause().hasMessageNotContaining("sensitive")
                                .hasMessageNotContaining("test-key").hasMessageNotContaining("private-query");
                    });
        }
    }

    @Test
    void rejectsMalformedResponsesRatherThanClaimingNoResults() {
        for (String body : new String[]{"{}", "null", "{bad-json", "{\"totalItems\":1}"}) {
            var builder = RestClient.builder().baseUrl("https://www.googleapis.com");
            var server = MockRestServiceServer.bindTo(builder).build();
            server.expect(anything()).andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
            var client = new GoogleBooksClient(builder.build(), new GoogleBooksProperties(null, "key"));
            assertThatThrownBy(() -> client.search("book"))
                    .isInstanceOfSatisfying(ResponseStatusException.class,
                            e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY));
        }
    }
}
