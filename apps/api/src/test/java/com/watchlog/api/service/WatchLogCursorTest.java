package com.watchlog.api.service;

import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WatchLogCursorTest {
    @Test
    void roundTripsHistoryCursor() {
        var at = OffsetDateTime.parse("2026-09-14T12:34:56.123+09:00");
        var id = UUID.fromString("00000000-0000-4000-8000-000000000123");

        var encoded = WatchLogCursor.encode(true, at, id);
        var decoded = WatchLogCursor.decode(encoded, true);

        assertThat(decoded.at().toInstant()).isEqualTo(at.toInstant());
        assertThat(decoded.id()).isEqualTo(id);
    }

    @Test
    void rejectsCursorForAnotherSort() {
        var cursor = WatchLogCursor.encode(
                true,
                OffsetDateTime.parse("2026-09-14T12:34:56Z"),
                UUID.fromString("00000000-0000-4000-8000-000000000123")
        );

        assertThatThrownBy(() -> WatchLogCursor.decode(cursor, false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("sort");
    }
}
