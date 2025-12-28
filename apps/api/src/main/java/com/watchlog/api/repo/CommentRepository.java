package com.watchlog.api.repo;

import com.watchlog.api.domain.CommentEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface CommentRepository extends JpaRepository<CommentEntity, UUID> {
    List<CommentEntity> findByDiscussion_IdOrderByCreatedAtAsc(UUID discussionId, Pageable pageable);

    @Modifying
    @Query(value = "update comments set user_id = cast(:toUserId as uuid) where user_id = cast(:fromUserId as uuid)", nativeQuery = true)
    int assignUser(UUID fromUserId, UUID toUserId);
}
