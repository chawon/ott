package com.watchlog.api.dto;

import com.watchlog.api.domain.BookClassificationEntity;
import com.watchlog.api.domain.BookClassificationStatus;

import java.time.OffsetDateTime;

public record BookClassificationDto(
        String isbn13,
        BookClassificationStatus status,
        String kdcCode,
        Integer kdcMajor,
        OffsetDateTime fetchedAt
) {
    public static BookClassificationDto from(BookClassificationEntity entity) {
        return new BookClassificationDto(
                entity.getIsbn13(),
                entity.getStatus(),
                entity.getKdcCode(),
                entity.getKdcMajor(),
                entity.getFetchedAt()
        );
    }
}
