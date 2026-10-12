package com.watchlog.api.service;

import com.watchlog.api.dto.NetflixImportRequest;
import com.watchlog.api.dto.NetflixImportResult;
import com.watchlog.api.dto.NetflixViewingEventDto;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class NetflixImportService {
    private static final int MAX_ROWS = 2_000;
    private static final String SOURCE = "NETFLIX";
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final JdbcTemplate jdbcTemplate;

    public NetflixImportService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public NetflixImportResult importRows(UUID userId, NetflixImportRequest request) {
        if (request == null || request.rows() == null || request.rows().isEmpty()
                || request.rows().size() > MAX_ROWS) {
            throw invalid("Import must contain 1 to " + MAX_ROWS + " rows");
        }

        // Validate the complete request before the first write. A malformed row never leaves a partial import.
        List<ValidatedRow> rows = request.rows().stream().map(this::validate).toList();
        Set<UUID> ownedVideoTitles = new HashSet<>(jdbcTemplate.queryForList("""
                select distinct w.title_id from watch_logs w
                join titles t on t.id = w.title_id
                where w.user_id = ? and w.deleted_at is null and t.type in ('movie', 'series')
                """, UUID.class, userId));

        int inserted = 0;
        int linked = 0;
        for (ValidatedRow row : rows) {
            UUID linkedTitleId = ownedVideoTitles.contains(row.linkedTitleId()) ? row.linkedTitleId() : null;
            int added = jdbcTemplate.update("""
                    insert into netflix_viewing_events
                        (id, user_id, source, source_key, title_id, raw_title, work_title,
                         viewed_on, occurrence, season_number, episode_number)
                    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    on conflict (user_id, source, source_key) do nothing
                    """,
                    UUID.randomUUID(), userId, SOURCE, row.sourceKey(), linkedTitleId,
                    row.rawTitle(), row.workTitle(), Date.valueOf(row.viewedOn()), row.occurrence(),
                    row.seasonNumber(), row.episodeNumber());
            inserted += added;
            if (added > 0 && linkedTitleId != null) linked++;
        }

        return new NetflixImportResult(rows.size(), inserted, rows.size() - inserted, linked);
    }

    @Transactional(readOnly = true)
    public List<NetflixViewingEventDto> list(UUID userId) {
        return jdbcTemplate.query("""
                select e.id, e.source_key, e.raw_title, e.work_title, e.viewed_on,
                       e.occurrence, e.season_number, e.episode_number,
                       case when w.id is null then null else e.title_id end as linked_title_id
                from netflix_viewing_events e
                left join watch_logs w on w.user_id = e.user_id
                    and w.title_id = e.title_id and w.deleted_at is null
                where e.user_id = ? and e.source = ?
                order by e.viewed_on desc, e.id desc
                """, (rs, rowNum) -> new NetflixViewingEventDto(
                rs.getObject("id", UUID.class),
                rs.getString("source_key"),
                rs.getString("raw_title"),
                rs.getString("work_title"),
                rs.getDate("viewed_on").toLocalDate(),
                rs.getInt("occurrence"),
                rs.getObject("season_number", Integer.class),
                rs.getObject("episode_number", Integer.class),
                rs.getObject("linked_title_id", UUID.class)
        ), userId, SOURCE);
    }

    @Transactional
    public void mergeUsers(UUID fromUserId, UUID toUserId) {
        jdbcTemplate.update("""
                delete from netflix_viewing_events source
                using netflix_viewing_events target
                where source.user_id = ? and target.user_id = ?
                    and source.source = target.source and source.source_key = target.source_key
                """, fromUserId, toUserId);
        jdbcTemplate.update("update netflix_viewing_events set user_id = ? where user_id = ?", toUserId, fromUserId);
    }

    private ValidatedRow validate(NetflixImportRequest.Row row) {
        if (row == null || row.rawTitle() == null || row.workTitle() == null || row.viewedOn() == null
                || row.occurrence() == null) {
            throw invalid("Each row needs a title, work title, date, and occurrence");
        }
        String rawTitle = row.rawTitle().trim();
        String workTitle = row.workTitle().trim();
        if (rawTitle.isEmpty() || rawTitle.length() > 500 || workTitle.isEmpty() || workTitle.length() > 255) {
            throw invalid("Title length is invalid");
        }
        if (row.viewedOn().isBefore(LocalDate.of(1997, 1, 1))
                || row.viewedOn().isAfter(LocalDate.now(KST).plusDays(1))) {
            throw invalid("Viewing date is invalid");
        }
        if (row.occurrence() < 1 || row.occurrence() > 10_000
                || (row.seasonNumber() != null && (row.seasonNumber() < 0 || row.seasonNumber() > 1_000))
                || (row.episodeNumber() != null && (row.episodeNumber() < 0 || row.episodeNumber() > 10_000))) {
            throw invalid("Episode or occurrence number is invalid");
        }
        return new ValidatedRow(rawTitle, workTitle, row.viewedOn(), row.occurrence(),
                row.seasonNumber(), row.episodeNumber(), row.linkedTitleId(),
                sourceKey(rawTitle, row.viewedOn(), row.occurrence()));
    }

    public static String sourceKey(String rawTitle, LocalDate viewedOn, int occurrence) {
        String input = rawTitle + "\n" + viewedOn + "\n" + occurrence;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private static ResponseStatusException invalid(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }

    private record ValidatedRow(String rawTitle, String workTitle, LocalDate viewedOn,
                                int occurrence, Integer seasonNumber, Integer episodeNumber,
                                UUID linkedTitleId, String sourceKey) {}
}
