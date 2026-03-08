package com.watchlog.api.repo;

import com.watchlog.api.domain.FeedbackMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FeedbackMessageRepository extends JpaRepository<FeedbackMessageEntity, UUID> {
    List<FeedbackMessageEntity> findByThread_IdOrderByCreatedAtAsc(UUID threadId);
}
