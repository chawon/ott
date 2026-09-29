package com.watchlog.api.service;

import com.watchlog.api.dto.NetflixImportRequest;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NetflixImportServiceTest {
    @Test
    void validatesOwnershipAndKeepsRetriesIdempotentWithoutChangingLogs() {
        UUID userId = UUID.randomUUID();
        UUID ownedTitle = UUID.randomUUID();
        UUID foreignTitle = UUID.randomUUID();
        var jdbc = new RecordingJdbcTemplate(List.of(ownedTitle));
        var service = new NetflixImportService(jdbc);
        var request = new NetflixImportRequest(List.of(
                new NetflixImportRequest.Row("A Show: 시즌 2: 제3화", "A Show",
                        LocalDate.of(2026, 9, 21), 1, 2, 3, ownedTitle),
                new NetflixImportRequest.Row("A Show: 시즌 2: 제3화", "A Show",
                        LocalDate.of(2026, 9, 21), 2, 2, 3, foreignTitle)
        ));

        var first = service.importRows(userId, request);
        var second = service.importRows(userId, request);

        assertThat(first.inserted()).isEqualTo(2);
        assertThat(first.linked()).isEqualTo(1);
        assertThat(second.inserted()).isZero();
        assertThat(second.alreadyImported()).isEqualTo(2);
        assertThat(second.linked()).isZero();
        assertThat(jdbc.inserts.get(0)[4]).isEqualTo(ownedTitle);
        assertThat(jdbc.inserts.get(1)[4]).isNull();
        assertThat(jdbc.inserts).hasSize(4);
    }

    @Test
    void rejectsTheWholeMalformedBatchBeforeWriting() {
        var jdbc = new RecordingJdbcTemplate(List.of());
        var service = new NetflixImportService(jdbc);
        var request = new NetflixImportRequest(List.of(
                new NetflixImportRequest.Row("Film", "Film", LocalDate.of(2026, 9, 21), 1, null, null, null),
                new NetflixImportRequest.Row("", "Film", LocalDate.of(2026, 9, 21), 1, null, null, null)
        ));

        assertThatThrownBy(() -> service.importRows(UUID.randomUUID(), request))
                .isInstanceOf(ResponseStatusException.class);
        assertThat(jdbc.inserts).isEmpty();
    }

    @Test
    void sourceKeyMatchesTheBrowserHashForKoreanEpisodeTitles() {
        assertThat(NetflixImportService.sourceKey("A Show: 시즌 2: 제3화", LocalDate.of(2026, 9, 21), 1))
                .isEqualTo("04a7c72f613657c4707c200e9fde5a9f30f05768e940e236720645e1f99c8355");
    }

    private static class RecordingJdbcTemplate extends JdbcTemplate {
        private final List<UUID> ownedTitles;
        private final Set<String> insertedKeys = new HashSet<>();
        private final List<Object[]> inserts = new ArrayList<>();

        RecordingJdbcTemplate(List<UUID> ownedTitles) {
            this.ownedTitles = ownedTitles;
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> List<T> queryForList(String sql, Class<T> elementType, Object... args) {
            return (List<T>) ownedTitles;
        }

        @Override
        public int update(String sql, Object... args) {
            assertThat(sql).contains("insert into netflix_viewing_events");
            inserts.add(args);
            return insertedKeys.add((String) args[3]) ? 1 : 0;
        }
    }
}
