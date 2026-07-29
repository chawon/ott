package com.watchlog.api.data4library;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class Data4LibraryClientTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void readsClassNumberFromBookDetailResponse() throws Exception {
        var response = objectMapper.readTree("""
                {
                  "response": {
                    "detail": [
                      {
                        "book": {
                          "isbn13": "9788983921987",
                          "class_no": "813.7"
                        }
                      }
                    ]
                  }
                }
                """);

        assertThat(Data4LibraryClient.parseKdcCode(response))
                .contains("813.7");
    }

    @Test
    void returnsEmptyWhenClassificationIsMissing() throws Exception {
        var response = objectMapper.readTree("""
                {
                  "response": {
                    "detail": []
                  }
                }
                """);

        assertThat(Data4LibraryClient.parseKdcCode(response)).isEmpty();
    }

    @Test
    void fetchesKdcWithData4LibraryCompatibleAcceptHeader() throws Exception {
        var acceptHeader = new AtomicReference<String>();
        var rawQuery = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/srchDtlList", exchange -> {
            String accept = exchange.getRequestHeaders().getFirst("Accept");
            acceptHeader.set(accept);
            rawQuery.set(exchange.getRequestURI().getRawQuery());
            if (accept != null && !accept.contains("*/*")) {
                exchange.sendResponseHeaders(406, -1);
                exchange.close();
                return;
            }

            byte[] body = """
                    {
                      "response": {
                        "detail": [
                          {
                            "book": {
                              "isbn13": "9788983921987",
                              "class_no": "843"
                            }
                          }
                        ]
                      }
                    }
                    """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (var output = exchange.getResponseBody()) {
                output.write(body);
            }
        });
        server.start();

        try {
            var properties = new Data4LibraryProperties(
                    "http://127.0.0.1:" + server.getAddress().getPort(),
                    "test-key"
            );
            var restClient = new Data4LibraryConfig().data4LibraryRestClient(properties);
            var client = new Data4LibraryClient(restClient, properties);

            assertThat(client.fetchKdcCode("9788983921987")).contains("843");
            assertThat(acceptHeader.get()).contains("*/*");
            assertThat(rawQuery.get())
                    .contains(
                            "authKey=test-key",
                            "isbn13=9788983921987",
                            "loaninfoYN=N",
                            "format=json"
                    );
        } finally {
            server.stop(0);
        }
    }
}
