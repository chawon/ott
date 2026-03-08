package com.watchlog.api.domain;

import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "feedback_messages")
public class FeedbackMessageEntity {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "thread_id", nullable = false)
    private FeedbackThreadEntity thread;

    @Enumerated(EnumType.STRING)
    @Column(name = "author_role", nullable = false, length = 16)
    private FeedbackAuthorRole authorRole;

    @Column(name = "body", nullable = false, columnDefinition = "text")
    private String body;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    protected FeedbackMessageEntity() {}

    public FeedbackMessageEntity(UUID id, FeedbackThreadEntity thread, FeedbackAuthorRole authorRole, String body) {
        this.id = id;
        this.thread = thread;
        this.authorRole = authorRole;
        this.body = body;
    }

    public UUID getId() { return id; }
    public FeedbackThreadEntity getThread() { return thread; }
    public FeedbackAuthorRole getAuthorRole() { return authorRole; }
    public String getBody() { return body; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
