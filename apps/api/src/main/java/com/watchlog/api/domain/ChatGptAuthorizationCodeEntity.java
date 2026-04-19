package com.watchlog.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "chatgpt_oauth_authorization_codes")
public class ChatGptAuthorizationCodeEntity {

    @Id
    @Column(length = 128)
    private String code;

    @Column(name = "client_id", nullable = false, columnDefinition = "text")
    private String clientId;

    @Column(name = "redirect_uri", nullable = false, columnDefinition = "text")
    private String redirectUri;

    @Column(name = "code_challenge", nullable = false, length = 256)
    private String codeChallenge;

    @Column(name = "scopes", nullable = false, columnDefinition = "text")
    private String scopes;

    @Column(name = "resource", columnDefinition = "text")
    private String resource;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(name = "device_id", nullable = false, columnDefinition = "uuid")
    private UUID deviceId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "used_at")
    private OffsetDateTime usedAt;

    protected ChatGptAuthorizationCodeEntity() {}

    public ChatGptAuthorizationCodeEntity(
            String code,
            String clientId,
            String redirectUri,
            String codeChallenge,
            String scopes,
            String resource,
            UUID userId,
            UUID deviceId,
            OffsetDateTime expiresAt
    ) {
        this.code = code;
        this.clientId = clientId;
        this.redirectUri = redirectUri;
        this.codeChallenge = codeChallenge;
        this.scopes = scopes;
        this.resource = resource;
        this.userId = userId;
        this.deviceId = deviceId;
        this.expiresAt = expiresAt;
    }

    public String getCode() {
        return code;
    }

    public String getClientId() {
        return clientId;
    }

    public String getRedirectUri() {
        return redirectUri;
    }

    public String getCodeChallenge() {
        return codeChallenge;
    }

    public String getScopes() {
        return scopes;
    }

    public String getResource() {
        return resource;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getDeviceId() {
        return deviceId;
    }

    public OffsetDateTime getExpiresAt() {
        return expiresAt;
    }

    public OffsetDateTime getUsedAt() {
        return usedAt;
    }

    public boolean isExpired() {
        return expiresAt.isBefore(OffsetDateTime.now());
    }

    public void markUsed() {
        this.usedAt = OffsetDateTime.now();
    }
}
