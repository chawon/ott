package com.watchlog.api.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "watch_logs")
public class WatchLogEntity {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "title_id", nullable = false)
    private TitleEntity title;

    @Column(name = "user_id")
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    @Column(precision = 2, scale = 1)
    private BigDecimal rating;

    @Column(columnDefinition = "text")
    private String note;

    @Column(nullable = false)
    private boolean spoiler = false;

    @Column(columnDefinition = "TEXT")
    private String ott;

    @Column(name = "watched_at", nullable = false)
    private OffsetDateTime watchedAt = OffsetDateTime.now();

    @Column(name = "season_number")
    private Integer seasonNumber;

    @Column(name = "episode_number")
    private Integer episodeNumber;

    @Column(name = "season_poster_url", columnDefinition = "text")
    private String seasonPosterUrl;

    @Column(name = "season_year")
    private Integer seasonYear;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private LogOrigin origin = LogOrigin.LOG;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private Place place;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private Occasion occasion;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    protected WatchLogEntity() {}

    public WatchLogEntity(UUID id, TitleEntity title, Status status) {
        this.id = id;
        this.title = title;
        this.status = status;
    }

    public UUID getId() { return id; }
    public TitleEntity getTitle() { return title; }
    public UUID getUserId() { return userId; }
    public Status getStatus() { return status; }
    public BigDecimal getRating() { return rating; }
    public String getNote() { return note; }
    public boolean isSpoiler() { return spoiler; }
    public String getOtt() { return ott; }
    public OffsetDateTime getWatchedAt() { return watchedAt; }
    public Integer getSeasonNumber() { return seasonNumber; }
    public Integer getEpisodeNumber() { return episodeNumber; }
    public String getSeasonPosterUrl() { return seasonPosterUrl; }
    public Integer getSeasonYear() { return seasonYear; }
    public LogOrigin getOrigin() { return origin; }
    public Place getPlace() { return place; }
    public Occasion getOccasion() { return occasion; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public OffsetDateTime getDeletedAt() { return deletedAt; }

    public void setStatus(Status status) { this.status = status; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public void setRating(BigDecimal rating) { this.rating = rating; }
    public void setNote(String note) { this.note = note; }
    public void setSpoiler(boolean spoiler) { this.spoiler = spoiler; }
    public void setOtt(String ott) { this.ott = ott; }
    public void setWatchedAt(OffsetDateTime watchedAt) { this.watchedAt = watchedAt; }
    public void setSeasonNumber(Integer seasonNumber) { this.seasonNumber = seasonNumber; }
    public void setEpisodeNumber(Integer episodeNumber) { this.episodeNumber = episodeNumber; }
    public void setSeasonPosterUrl(String seasonPosterUrl) { this.seasonPosterUrl = seasonPosterUrl; }
    public void setSeasonYear(Integer seasonYear) { this.seasonYear = seasonYear; }
    public void setOrigin(LogOrigin origin) { this.origin = origin; }
    public void setPlace(Place place) { this.place = place; }
    public void setOccasion(Occasion occasion) { this.occasion = occasion; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
    public void setDeletedAt(OffsetDateTime deletedAt) { this.deletedAt = deletedAt; }
}
