package com.watchlog.api.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "watch_log_history")
public class WatchLogHistoryEntity {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "log_id", nullable = false)
    private WatchLogEntity log;

    @Column(name = "recorded_at", nullable = false)
    private OffsetDateTime recordedAt = OffsetDateTime.now();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    @Column(precision = 2, scale = 1)
    private BigDecimal rating;

    @Column(columnDefinition = "text")
    private String note;

    @Column(nullable = false)
    private boolean spoiler;

    @Column(length = 64)
    private String ott;

    @Column(name = "watched_at", nullable = false)
    private OffsetDateTime watchedAt;

    @Column(name = "season_number")
    private Integer seasonNumber;

    @Column(name = "episode_number")
    private Integer episodeNumber;

    @Column(name = "season_poster_url", columnDefinition = "text")
    private String seasonPosterUrl;

    @Column(name = "season_year")
    private Integer seasonYear;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private Place place;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private Occasion occasion;

    protected WatchLogHistoryEntity() {}

    public WatchLogHistoryEntity(UUID id, WatchLogEntity log) {
        this.id = id;
        this.log = log;
    }

    public UUID getId() { return id; }
    public WatchLogEntity getLog() { return log; }
    public OffsetDateTime getRecordedAt() { return recordedAt; }
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
    public Place getPlace() { return place; }
    public Occasion getOccasion() { return occasion; }

    public void setRecordedAt(OffsetDateTime recordedAt) { this.recordedAt = recordedAt; }
    public void setStatus(Status status) { this.status = status; }
    public void setRating(BigDecimal rating) { this.rating = rating; }
    public void setNote(String note) { this.note = note; }
    public void setSpoiler(boolean spoiler) { this.spoiler = spoiler; }
    public void setOtt(String ott) { this.ott = ott; }
    public void setWatchedAt(OffsetDateTime watchedAt) { this.watchedAt = watchedAt; }
    public void setSeasonNumber(Integer seasonNumber) { this.seasonNumber = seasonNumber; }
    public void setEpisodeNumber(Integer episodeNumber) { this.episodeNumber = episodeNumber; }
    public void setSeasonPosterUrl(String seasonPosterUrl) { this.seasonPosterUrl = seasonPosterUrl; }
    public void setSeasonYear(Integer seasonYear) { this.seasonYear = seasonYear; }
    public void setPlace(Place place) { this.place = place; }
    public void setOccasion(Occasion occasion) { this.occasion = occasion; }
}
