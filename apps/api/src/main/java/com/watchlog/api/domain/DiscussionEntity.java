package com.watchlog.api.domain;

import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "discussions")
public class DiscussionEntity {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "title_id", nullable = false, unique = true)
    private TitleEntity title;

    @Column(name = "comment_seq", nullable = false)
    private int commentSeq = 0;

    @Column(name = "locale", nullable = false)
    private String locale = "ko";

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    protected DiscussionEntity() {}

    public DiscussionEntity(UUID id, TitleEntity title, String locale) {
        this.id = id;
        this.title = title;
        this.locale = locale;
    }

    public UUID getId() { return id; }
    public TitleEntity getTitle() { return title; }
    public int getCommentSeq() { return commentSeq; }
    public String getLocale() { return locale; }
    public OffsetDateTime getCreatedAt() { return createdAt; }

    public void setCommentSeq(int commentSeq) { this.commentSeq = commentSeq; }
}
