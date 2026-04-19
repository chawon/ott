package com.watchlog.api.repo;

import com.watchlog.api.domain.CommentEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CommentRepository extends JpaRepository<CommentEntity, UUID> {
    List<CommentEntity> findByDiscussion_IdOrderByCreatedAtAsc(UUID discussionId, Pageable pageable);

    @Query("select distinct c.discussion.id from CommentEntity c where c.userId = :userId")
    List<UUID> findDistinctDiscussionIdsByUserId(@Param("userId") UUID userId);

    @Modifying
    @Query(value = "delete from comments where user_id = cast(:userId as uuid)", nativeQuery = true)
    int deleteByUserId(@Param("userId") UUID userId);

    @Query(value = """
            select coalesce(max(cast(substring(c.author_name from '.*-([0-9]+)$') as int)), 0) + 1
            from comments c
            where c.discussion_id = cast(:discussionId as uuid)
            """, nativeQuery = true)
    int findNextAuthorSeq(@Param("discussionId") UUID discussionId);

    @Modifying
    @Query(value = "update comments set user_id = cast(:toUserId as uuid) where user_id = cast(:fromUserId as uuid)", nativeQuery = true)
    int assignUser(UUID fromUserId, UUID toUserId);
}
