package com.watchlog.api.repo;

import com.watchlog.api.domain.Occasion;
import com.watchlog.api.domain.Place;
import com.watchlog.api.domain.Status;
import com.watchlog.api.domain.WatchLogEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WatchLogRepository extends JpaRepository<WatchLogEntity, UUID> {

    @Query(value = """
            select * from watch_logs w
            where (cast(:userId as uuid) is null or w.user_id = cast(:userId as uuid))
              and (cast(:titleId as uuid) is null or w.title_id = cast(:titleId as uuid))
              and (cast(:status as text) is null or w.status = cast(:status as text))
              and (cast(:origin as text) is null or w.origin = cast(:origin as text))
              and (cast(:ott as text) is null or coalesce(w.ott, '') ilike concat('%', cast(:ott as text), '%'))
              and (cast(:place as text) is null or w.place = cast(:place as text))
              and (cast(:occasion as text) is null or w.occasion = cast(:occasion as text))
            order by w.watched_at desc
            """, nativeQuery = true)
    List<WatchLogEntity> findFiltered(
            @Param("userId") UUID userId,
            @Param("titleId") UUID titleId,
            @Param("status") String status,
            @Param("origin") String origin,
            @Param("ott") String ott,
            @Param("place") Place place,
            @Param("occasion") Occasion occasion,
            Pageable pageable
    );

    @Query(value = """
            select * from watch_logs w
            where (cast(:userId as uuid) is null or w.user_id = cast(:userId as uuid))
              and (cast(:titleId as uuid) is null or w.title_id = cast(:titleId as uuid))
              and (cast(:status as text) is null or w.status = cast(:status as text))
              and (cast(:origin as text) is null or w.origin = cast(:origin as text))
              and (cast(:ottPatterns as text[]) is null or coalesce(w.ott, '') ilike any (cast(:ottPatterns as text[])))
              and (cast(:place as text) is null or w.place = cast(:place as text))
              and (cast(:occasion as text) is null or w.occasion = cast(:occasion as text))
            order by w.watched_at desc
            """, nativeQuery = true)
    List<WatchLogEntity> findFilteredWithOttPatterns(
            @Param("userId") UUID userId,
            @Param("titleId") UUID titleId,
            @Param("status") String status,
            @Param("origin") String origin,
            @Param("ottPatterns") String[] ottPatterns,
            @Param("place") Place place,
            @Param("occasion") Occasion occasion,
            Pageable pageable
    );

    List<WatchLogEntity> findByUpdatedAtAfterOrDeletedAtAfter(OffsetDateTime updatedAt, OffsetDateTime deletedAt);

    @Query(value = """
            select * from watch_logs w
            where w.user_id = cast(:userId as uuid)
              and (w.updated_at > cast(:since as timestamptz) or w.deleted_at > cast(:since as timestamptz))
            order by w.updated_at desc
            """, nativeQuery = true)
    List<WatchLogEntity> findUserChangesAfter(@Param("userId") UUID userId, @Param("since") OffsetDateTime since);

    Optional<WatchLogEntity> findByTitle_IdAndDeletedAtIsNull(UUID titleId);

    Optional<WatchLogEntity> findByTitle_IdAndUserIdAndDeletedAtIsNull(UUID titleId, UUID userId);

    List<WatchLogEntity> findByUserId(UUID userId);

    @Query(value = """
            select distinct on (w.title_id) w.title_id, w.season_poster_url
            from watch_logs w
            where w.title_id in (:titleIds)
              and w.deleted_at is null
              and w.season_poster_url is not null
              and btrim(w.season_poster_url) <> ''
            order by w.title_id, w.updated_at desc
            """, nativeQuery = true)
    List<Object[]> findLatestSeasonPosterUrlsByTitleIds(@Param("titleIds") List<UUID> titleIds);

    @Modifying
    @Query(value = "update watch_logs set user_id = cast(:userId as uuid) where user_id is null", nativeQuery = true)
    int assignUserToOrphanLogs(@Param("userId") UUID userId);
}
