package com.watchlog.api.dto;

import com.watchlog.api.domain.TitleEntity;
import com.watchlog.api.domain.TitleType;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record SyncTitleDto(
        UUID id,
        TitleType type,
        String name,
        Integer year,
        List<String> genres,
        List<String> directors,
        List<String> cast,
        String overview,
        String posterUrl,
        String author,
        String publisher,
        String isbn10,
        String isbn13,
        String pubdate,
        String provider,
        String providerId,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        OffsetDateTime deletedAt
) {
    public static SyncTitleDto from(TitleEntity e) {
        return new SyncTitleDto(
                e.getId(),
                e.getType(),
                e.getName(),
                e.getYear(),
                e.genresList(),
                e.directorsList(),
                e.castList(),
                e.getOverview(),
                e.getPosterUrl(),
                e.getAuthor(),
                e.getPublisher(),
                e.getIsbn10(),
                e.getIsbn13(),
                e.getPubdate(),
                e.getProvider(),
                e.getProviderId(),
                e.getCreatedAt(),
                e.getUpdatedAt(),
                e.getDeletedAt()
        );
    }
}
