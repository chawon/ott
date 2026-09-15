package com.watchlog.api.service;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.UUID;

final class WatchLogCursor {
    private static final String VERSION = "1";

    private WatchLogCursor() {
    }

    static String encode(boolean sortByHistory, OffsetDateTime at, UUID id) {
        var sort = sortByHistory ? "history" : "watchedAt";
        var payload = String.join("\n", VERSION, sort, at.toInstant().toString(), id.toString());
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(payload.getBytes(StandardCharsets.UTF_8));
    }

    static Decoded decode(String cursor, boolean expectedSortByHistory) {
        if (cursor == null || cursor.isBlank()) return null;
        try {
            var payload = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            var parts = payload.split("\n", -1);
            if (parts.length != 4 || !VERSION.equals(parts[0])) {
                throw new IllegalArgumentException("Unsupported cursor");
            }
            var sortByHistory = switch (parts[1]) {
                case "history" -> true;
                case "watchedAt" -> false;
                default -> throw new IllegalArgumentException("Unsupported cursor sort");
            };
            if (sortByHistory != expectedSortByHistory) {
                throw new IllegalArgumentException("Cursor sort does not match request");
            }
            return new Decoded(
                    OffsetDateTime.ofInstant(java.time.Instant.parse(parts[2]), ZoneOffset.UTC),
                    UUID.fromString(parts[3])
            );
        } catch (RuntimeException error) {
            if (error instanceof IllegalArgumentException) throw error;
            throw new IllegalArgumentException("Invalid cursor", error);
        }
    }

    record Decoded(OffsetDateTime at, UUID id) {
    }
}
