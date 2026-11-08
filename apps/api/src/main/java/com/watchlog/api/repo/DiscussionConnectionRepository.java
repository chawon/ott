package com.watchlog.api.repo;

import com.watchlog.api.domain.DiscussionEntity;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

/** A bounded existence query; deliberately exposes no mutation methods. */
public interface DiscussionConnectionRepository extends Repository<DiscussionEntity, UUID> {
    @Query(value = """
            select d.id
            from discussions d
            join titles t on t.id = d.title_id
            where d.title_id = cast(:titleId as uuid)
              and t.deleted_at is null
              and exists (
                select 1 from comments c
                where c.discussion_id = d.id
                  and (c.user_id is null or c.user_id <> cast(:userId as uuid))
                  and c.body ~ '[^[:space:]]'
              )
            limit 1
            """, nativeQuery = true)
    Optional<UUID> findConnectionId(@Param("titleId") UUID titleId, @Param("userId") UUID userId);
}
