package com.watchlog.api.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "titles")
public class TitleEntity {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TitleType type;

    @Column(nullable = false, length = 255)
    private String name;

    @Column
    private Integer year;

    @Column(columnDefinition = "text")
    private String overview;

    @Column(name = "poster_url", columnDefinition = "text")
    private String posterUrl;

    @Column(name = "author", length = 255)
    private String author;

    @Column(name = "publisher", length = 255)
    private String publisher;

    @Column(name = "isbn10", length = 10)
    private String isbn10;

    @Column(name = "isbn13", length = 13)
    private String isbn13;

    @Column(name = "pubdate", length = 8)
    private String pubdate;

    @Column(name = "genres", columnDefinition = "text[]", nullable = false)
    @JdbcTypeCode(SqlTypes.ARRAY) // Add this annotation
    private String[] genres = new String[0];

    @Column(name = "directors", columnDefinition = "text[]", nullable = false)
    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] directors = new String[0];

    @Column(name = "cast_names", columnDefinition = "text[]", nullable = false)
    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] castNames = new String[0];

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @Column(nullable = false, length = 16)
    private String provider = "LOCAL";

    @Column(name = "provider_id", length = 64)
    private String providerId;

    protected TitleEntity() {}

    public TitleEntity(UUID id, TitleType type, String name) {
        this.id = id;
        this.type = type;
        this.name = name;
    }

    public UUID getId() { return id; }
    public TitleType getType() { return type; }
    public String getName() { return name; }
    public Integer getYear() { return year; }
    public String getOverview() { return overview; }
    public String getPosterUrl() { return posterUrl; }
    public String getAuthor() { return author; }
    public String getPublisher() { return publisher; }
    public String getIsbn10() { return isbn10; }
    public String getIsbn13() { return isbn13; }
    public String getPubdate() { return pubdate; }
    public String[] getGenres() { return genres; }
    public String[] getDirectors() { return directors; }
    public String[] getCastNames() { return castNames; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public OffsetDateTime getDeletedAt() { return deletedAt; }

    public void setYear(Integer year) { this.year = year; }
    public void setOverview(String overview) { this.overview = overview; }
    public void setPosterUrl(String posterUrl) { this.posterUrl = posterUrl; }
    public void setAuthor(String author) { this.author = author; }
    public void setPublisher(String publisher) { this.publisher = publisher; }
    public void setIsbn10(String isbn10) { this.isbn10 = isbn10; }
    public void setIsbn13(String isbn13) { this.isbn13 = isbn13; }
    public void setPubdate(String pubdate) { this.pubdate = pubdate; }
    public void setGenres(String[] genres) { this.genres = genres == null ? new String[0] : genres; }
    public void setDirectors(String[] directors) { this.directors = directors == null ? new String[0] : directors; }
    public void setCastNames(String[] castNames) { this.castNames = castNames == null ? new String[0] : castNames; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
    public void setDeletedAt(OffsetDateTime deletedAt) { this.deletedAt = deletedAt; }

    public String getProvider() { return provider; }
    public String getProviderId() { return providerId; }
    public void setProvider(String provider) { this.provider = provider; }
    public void setProviderId(String providerId) { this.providerId = providerId; }

    public List<String> genresList() {
        return Arrays.asList(genres == null ? new String[0] : genres);
    }

    public List<String> directorsList() {
        return Arrays.asList(directors == null ? new String[0] : directors);
    }

    public List<String> castList() {
        return Arrays.asList(castNames == null ? new String[0] : castNames);
    }

    public void setType(TitleType type) { this.type = type; }
    public void setName(String name) { this.name = name; }
}
