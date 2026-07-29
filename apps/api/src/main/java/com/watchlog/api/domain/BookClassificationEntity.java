package com.watchlog.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "book_classifications")
public class BookClassificationEntity {

    @Id
    @Column(length = 13)
    private String isbn13;

    @Column(name = "kdc_code", length = 32)
    private String kdcCode;

    @Column(name = "kdc_major")
    private Integer kdcMajor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private BookClassificationStatus status;

    @Column(nullable = false, length = 32)
    private String source = "DATA4LIBRARY";

    @Column(name = "fetched_at", nullable = false)
    private OffsetDateTime fetchedAt;

    protected BookClassificationEntity() {}

    public BookClassificationEntity(
            String isbn13,
            String kdcCode,
            Integer kdcMajor,
            BookClassificationStatus status,
            OffsetDateTime fetchedAt
    ) {
        this.isbn13 = isbn13;
        this.kdcCode = kdcCode;
        this.kdcMajor = kdcMajor;
        this.status = status;
        this.fetchedAt = fetchedAt;
    }

    public String getIsbn13() { return isbn13; }
    public String getKdcCode() { return kdcCode; }
    public Integer getKdcMajor() { return kdcMajor; }
    public BookClassificationStatus getStatus() { return status; }
    public String getSource() { return source; }
    public OffsetDateTime getFetchedAt() { return fetchedAt; }
}
