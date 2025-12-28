package com.watchlog.api.domain;

import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "comments")
public class CommentEntity {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "discussion_id", nullable = false)
    private DiscussionEntity discussion;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "author_name", nullable = false, length = 255)
    private String authorName;

    @Column(name = "body", nullable = false, columnDefinition = "text")
    private String body;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    protected CommentEntity() {}

    public CommentEntity(UUID id, DiscussionEntity discussion, String authorName, String body) {
        this.id = id;
        this.discussion = discussion;
        this.authorName = authorName;
        this.body = body;
    }

    public UUID getId() { return id; }
    public DiscussionEntity getDiscussion() { return discussion; }
    public UUID getUserId() { return userId; }
    public String getAuthorName() { return authorName; }
    public String getBody() { return body; }
    public OffsetDateTime getCreatedAt() { return createdAt; }

    public void setUserId(UUID userId) { this.userId = userId; }
}
