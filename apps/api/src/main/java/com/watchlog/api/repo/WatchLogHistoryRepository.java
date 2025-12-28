package com.watchlog.api.repo;

import com.watchlog.api.domain.WatchLogHistoryEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WatchLogHistoryRepository extends JpaRepository<WatchLogHistoryEntity, UUID> {
    List<WatchLogHistoryEntity> findByLog_IdOrderByRecordedAtDesc(UUID logId, Pageable pageable);
}
