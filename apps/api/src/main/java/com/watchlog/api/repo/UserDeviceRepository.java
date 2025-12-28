package com.watchlog.api.repo;

import com.watchlog.api.domain.UserDeviceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserDeviceRepository extends JpaRepository<UserDeviceEntity, UUID> {
    List<UserDeviceEntity> findByUser_IdOrderByCreatedAtAsc(UUID userId);

    Optional<UserDeviceEntity> findByIdAndUser_Id(UUID id, UUID userId);

    int deleteByUser_Id(UUID userId);
}
