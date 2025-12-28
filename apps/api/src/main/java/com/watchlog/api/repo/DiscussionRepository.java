package com.watchlog.api.repo;

import com.watchlog.api.domain.DiscussionEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DiscussionRepository extends JpaRepository<DiscussionEntity, UUID> {
    Optional<DiscussionEntity> findByTitle_Id(UUID titleId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<DiscussionEntity> findWithLockById(UUID id);

    @Query("select d from DiscussionEntity d join fetch d.title where d.id = :id")
    Optional<DiscussionEntity> findByIdWithTitle(UUID id);

    @Query("select d from DiscussionEntity d join fetch d.title order by d.createdAt desc")
    List<DiscussionEntity> findLatest(Pageable pageable);
}
