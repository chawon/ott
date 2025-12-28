package com.watchlog.api.repo;

import com.watchlog.api.domain.TitleEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TitleRepository extends JpaRepository<TitleEntity, UUID> {
    List<TitleEntity> findTop10ByNameContainingIgnoreCaseOrderByNameAsc(String name);

    Optional<TitleEntity> findByProviderAndProviderId(String provider, String providerId);

    List<TitleEntity> findByUpdatedAtAfterOrDeletedAtAfter(OffsetDateTime updatedAt, OffsetDateTime deletedAt);

}
