package com.watchlog.api.repo;

import com.watchlog.api.domain.RecommendationCacheEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RecommendationCacheRepository extends JpaRepository<RecommendationCacheEntity, UUID> {
    Optional<RecommendationCacheEntity> findByUserId(UUID userId);
    void deleteByUserId(UUID userId);
}
