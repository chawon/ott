package com.watchlog.api.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Publishes committed DB changes into the timestamp protocol used by installed clients. */
@Component
public class SyncDeliveryStore {
    private final JdbcTemplate jdbc;

    public SyncDeliveryStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void lockPush(UUID userId) {
        // Read conflict versions only after an earlier sync writer has committed.
        // Scope to the account: unrelated users do not wait for this push's metadata network call.
        if (userId != null) {
            jdbc.queryForObject("select pg_advisory_xact_lock(hashtextextended(current_schema() || '.ottline.sync.push.' || cast(? as text), 0))",
                    Object.class, userId);
        }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public PullWindow preparePull(OffsetDateTime since, UUID userId, UUID deviceId) {
        // Only pull publishers serialize. Source-row writers never take this fence.
        // Millisecond cursors also survive legacy clients that normalize ISO timestamps.
        var watermark = jdbc.queryForObject("""
                update sync_delivery_clock
                   set watermark = greatest(date_trunc('milliseconds', clock_timestamp()), watermark + interval '1 millisecond')
                 where id = 1 returning watermark
                """, (rs, row) -> rs.getObject(1, OffsetDateTime.class));

        // The materialized set contains only this statement's committed receipts.
        // A transaction committing later stays pending, even with a smaller sequence ID.
        jdbc.update("""
                with pending as materialized (
                    select id, entity_type, entity_id from sync_pending_changes
                ), published as (
                    insert into sync_deliveries(entity_type, entity_id, delivered_at)
                    select entity_type, entity_id, cast(? as timestamptz)
                    from pending group by entity_type, entity_id
                    on conflict (entity_type, entity_id) do update set delivered_at = excluded.delivered_at
                )
                delete from sync_pending_changes where id in (select id from pending)
                """, watermark);

        if (userId == null || deviceId == null) {
            // Legacy in-process callers lack a trustworthy per-device bootstrap identity.
            return new PullWindow(null, watermark);
        }
        var issued = jdbc.query("""
                select user_id, issued_cursor from sync_device_cursors where device_id = ? for update
                """, (rs, row) -> new IssuedCursor(rs.getObject(1, UUID.class),
                rs.getObject(2, OffsetDateTime.class)), deviceId);
        boolean acknowledged = !issued.isEmpty() && issued.getFirst().userId().equals(userId)
                && since != null && since.isEqual(issued.getFirst().cursor());
        jdbc.update("""
                insert into sync_device_cursors(device_id, user_id, issued_cursor) values (?, ?, ?)
                on conflict (device_id) do update set user_id = excluded.user_id, issued_cursor = excluded.issued_cursor
                """, deviceId, userId, watermark);
        // Lost/old-image/out-of-order cursors are not evidence that this client applied our last payload.
        // Repair, then require its exact serverTime on the next normal incremental request.
        return new PullWindow(acknowledged ? since : null, watermark);
    }

    public record PullWindow(OffsetDateTime since, OffsetDateTime serverTime) {}
    private record IssuedCursor(UUID userId, OffsetDateTime cursor) {}
}
