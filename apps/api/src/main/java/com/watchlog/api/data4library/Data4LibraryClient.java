package com.watchlog.api.data4library;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;

import java.util.Iterator;
import java.util.Optional;

@Component
public class Data4LibraryClient {

    private final RestClient restClient;
    private final Data4LibraryProperties properties;

    public Data4LibraryClient(
            @Qualifier("data4LibraryRestClient") RestClient restClient,
            Data4LibraryProperties properties
    ) {
        this.restClient = restClient;
        this.properties = properties;
    }

    public Optional<String> fetchKdcCode(String isbn13) {
        if (!properties.configured()) {
            throw new Data4LibraryUnavailableException("Data4Library credentials are missing");
        }

        var uri = UriComponentsBuilder.fromPath("/api/srchDtlList")
                .queryParam("authKey", properties.authKey())
                .queryParam("isbn13", isbn13)
                .queryParam("loaninfoYN", "N")
                .queryParam("format", "json")
                .build()
                .toUriString();

        try {
            JsonNode response = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(JsonNode.class);
            return parseKdcCode(response);
        } catch (RestClientException exception) {
            throw new Data4LibraryUnavailableException(
                    "Data4Library is temporarily unavailable",
                    exception
            );
        }
    }

    static Optional<String> parseKdcCode(JsonNode response) {
        if (response == null || response.isNull()) {
            return Optional.empty();
        }
        return findFirstField(response, "class_no")
                .map(JsonNode::asString)
                .map(String::trim)
                .filter(value -> !value.isBlank());
    }

    private static Optional<JsonNode> findFirstField(JsonNode node, String fieldName) {
        if (node.isObject()) {
            JsonNode direct = node.get(fieldName);
            if (direct != null && !direct.isNull()) {
                return Optional.of(direct);
            }
            Iterator<JsonNode> children = node.iterator();
            while (children.hasNext()) {
                Optional<JsonNode> found = findFirstField(children.next(), fieldName);
                if (found.isPresent()) {
                    return found;
                }
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                Optional<JsonNode> found = findFirstField(child, fieldName);
                if (found.isPresent()) {
                    return found;
                }
            }
        }
        return Optional.empty();
    }
}
