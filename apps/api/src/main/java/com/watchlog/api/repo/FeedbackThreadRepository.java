package com.watchlog.api.repo;

import com.watchlog.api.domain.FeedbackThreadEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface FeedbackThreadRepository extends JpaRepository<FeedbackThreadEntity, UUID> {
    List<FeedbackThreadEntity> findByUserIdOrderByUpdatedAtDesc(UUID userId);
    List<FeedbackThreadEntity> findAllByOrderByUpdatedAtDesc(Pageable pageable);

    @Modifying
    @Query(value = "delete from feedback_threads where user_id = cast(:userId as uuid)", nativeQuery = true)
    int deleteByUserId(@Param("userId") UUID userId);
}
