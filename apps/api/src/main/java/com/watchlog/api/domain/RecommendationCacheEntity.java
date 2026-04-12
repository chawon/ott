package com.watchlog.api.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "recommendation_cache")
public class RecommendationCacheEntity {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID userId;

    @Column(length = 8, nullable = false)
    private String language;

    @Column(columnDefinition = "text", nullable = false)
    private String responseJson;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    public RecommendationCacheEntity() {}

    public RecommendationCacheEntity(UUID userId, String language, String responseJson, OffsetDateTime createdAt) {
        this.userId = userId;
        this.language = language;
        this.responseJson = responseJson;
        this.createdAt = createdAt;
    }

    public UUID getUserId() { return userId; }
    public String getLanguage() { return language; }
    public String getResponseJson() { return responseJson; }
    public OffsetDateTime getCreatedAt() { return createdAt; }

    public void setUserId(UUID userId) { this.userId = userId; }
    public void setLanguage(String language) { this.language = language; }
    public void setResponseJson(String responseJson) { this.responseJson = responseJson; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
