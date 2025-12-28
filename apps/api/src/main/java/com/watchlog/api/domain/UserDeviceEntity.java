package com.watchlog.api.domain;

import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_devices")
public class UserDeviceEntity {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "last_seen_at", nullable = false)
    private OffsetDateTime lastSeenAt = OffsetDateTime.now();

    @Column(name = "user_agent", columnDefinition = "text")
    private String userAgent;

    @Column(name = "os", length = 64)
    private String os;

    @Column(name = "browser", length = 64)
    private String browser;

    protected UserDeviceEntity() {}

    public UserDeviceEntity(UUID id, UserEntity user) {
        this.id = id;
        this.user = user;
    }

    public UUID getId() { return id; }
    public UserEntity getUser() { return user; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getLastSeenAt() { return lastSeenAt; }
    public String getUserAgent() { return userAgent; }
    public String getOs() { return os; }
    public String getBrowser() { return browser; }

    public void touch() { this.lastSeenAt = OffsetDateTime.now(); }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }
    public void setOs(String os) { this.os = os; }
    public void setBrowser(String browser) { this.browser = browser; }
}
