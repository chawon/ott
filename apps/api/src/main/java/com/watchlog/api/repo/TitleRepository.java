package com.watchlog.api.repo;

import com.watchlog.api.domain.TitleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.watchlog.api.book.BookIsbn;
import com.watchlog.api.domain.TitleType;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TitleRepository extends JpaRepository<TitleEntity, UUID> {
    List<TitleEntity> findTop10ByNameContainingIgnoreCaseOrderByNameAsc(String name);

    Optional<TitleEntity> findByProviderAndProviderId(String provider, String providerId);

    @Query("""
            select t from TitleEntity t where t.type = com.watchlog.api.domain.TitleType.book
            and t.provider in ('NAVER', 'KAKAO') and t.deletedAt is null
            and ((:isbn13 is not null and (t.isbn13 = :isbn13 or t.providerId = :isbn13))
              or (:isbn10 is not null and (t.isbn10 = :isbn10 or t.providerId = :isbn10)))
            order by t.createdAt, t.id
            """)
    List<TitleEntity> findBookEdition(@Param("isbn10") String isbn10, @Param("isbn13") String isbn13);

    default Optional<TitleEntity> resolveExternalTitle(String provider, String providerId, TitleType type,
                                                       String isbn10, String isbn13) {
        var exact = findByProviderAndProviderId(provider, providerId);
        if (exact.isPresent() || type != TitleType.book
                || !("NAVER".equals(provider) || "KAKAO".equals(provider))) return exact;
        var isbn = BookIsbn.parse(String.join(" ", isbn10 == null ? "" : isbn10,
                isbn13 == null ? "" : isbn13));
        if (isbn.isbn13() == null) isbn = BookIsbn.parse(providerId);
        if (isbn.isbn13() == null) return Optional.empty();
        return findBookEdition(isbn.isbn10(), isbn.isbn13()).stream().findFirst();
    }

    List<TitleEntity> findByUpdatedAtAfterOrDeletedAtAfter(OffsetDateTime updatedAt, OffsetDateTime deletedAt);

}
