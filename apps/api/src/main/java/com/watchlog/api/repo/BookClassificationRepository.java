package com.watchlog.api.repo;

import com.watchlog.api.domain.BookClassificationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookClassificationRepository extends JpaRepository<BookClassificationEntity, String> {
}
