package com.watchlog.api.repo;

import com.watchlog.api.domain.FeedbackThreadEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FeedbackThreadRepository extends JpaRepository<FeedbackThreadEntity, UUID> {
    List<FeedbackThreadEntity> findByUserIdOrderByUpdatedAtDesc(UUID userId);
    List<FeedbackThreadEntity> findAllByOrderByUpdatedAtDesc(Pageable pageable);
}
