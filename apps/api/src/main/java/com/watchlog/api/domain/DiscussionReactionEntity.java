package com.watchlog.api.domain;

import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "discussion_reactions",
        uniqueConstraints = @UniqueConstraint(name = "uk_discussion_reaction_user", columnNames = {"discussion_id", "user_id"})
)
public class DiscussionReactionEntity {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "discussion_id", nullable = false)
    private DiscussionEntity discussion;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DiscussionReactionType type;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    protected DiscussionReactionEntity() {}

    public DiscussionReactionEntity(UUID id, DiscussionEntity discussion, UUID userId, DiscussionReactionType type) {
        this.id = id;
        this.discussion = discussion;
        this.userId = userId;
        this.type = type;
    }

    public UUID getId() { return id; }
    public DiscussionEntity getDiscussion() { return discussion; }
    public UUID getUserId() { return userId; }
    public DiscussionReactionType getType() { return type; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }

    public void setType(DiscussionReactionType type) {
        this.type = type;
        this.updatedAt = OffsetDateTime.now();
    }
}
