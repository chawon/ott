package com.watchlog.api.repo;

import com.watchlog.api.domain.DiscussionEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DiscussionRepository extends JpaRepository<DiscussionEntity, UUID> {
    Optional<DiscussionEntity> findByTitle_Id(UUID titleId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<DiscussionEntity> findWithLockById(UUID id);

    @Query("select d from DiscussionEntity d join fetch d.title where d.id = :id")
    Optional<DiscussionEntity> findByIdWithTitle(UUID id);

    @Query(value = """
            select d.id
            from discussions d
            left join comments c on c.discussion_id = d.id
            where (cast(:since as timestamptz) is null or d.created_at >= cast(:since as timestamptz))
              and (cast(:minComments as int) is null or d.comment_seq >= cast(:minComments as int))
            group by d.id, d.created_at
            order by coalesce(max(c.created_at), d.created_at) desc
            """, nativeQuery = true)
    List<UUID> findLatestIds(
            @Param("since") OffsetDateTime since,
            @Param("minComments") Integer minComments,
            Pageable pageable
    );

    @Query("select d from DiscussionEntity d join fetch d.title where d.id in :ids")
    List<DiscussionEntity> findByIdInWithTitle(@Param("ids") List<UUID> ids);
}
