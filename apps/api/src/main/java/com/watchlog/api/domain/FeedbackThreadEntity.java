package com.watchlog.api.domain;

import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "feedback_threads")
public class FeedbackThreadEntity {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 32)
    private FeedbackCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private FeedbackStatus status = FeedbackStatus.OPEN;

    @Column(name = "subject", length = 120)
    private String subject;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    protected FeedbackThreadEntity() {}

    public FeedbackThreadEntity(UUID id, UUID userId, FeedbackCategory category, String subject) {
        this.id = id;
        this.userId = userId;
        this.category = category;
        this.subject = subject;
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public FeedbackCategory getCategory() { return category; }
    public FeedbackStatus getStatus() { return status; }
    public String getSubject() { return subject; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }

    public void markAnswered() {
        this.status = FeedbackStatus.ANSWERED;
        this.updatedAt = OffsetDateTime.now();
    }

    public void markOpen() {
        this.status = FeedbackStatus.OPEN;
        this.updatedAt = OffsetDateTime.now();
    }

    public void touch() {
        this.updatedAt = OffsetDateTime.now();
    }
}
