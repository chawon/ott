package com.watchlog.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
public class UserEntity {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "pairing_code", nullable = false, length = 16, unique = true)
    private String pairingCode;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "nickname", length = 32)
    private String nickname;

    @Column(name = "persona_key", length = 32)
    private String personaKey;

    @Column(name = "profile_updated_at")
    private OffsetDateTime profileUpdatedAt;

    protected UserEntity() {}

    public UserEntity(UUID id, String pairingCode) {
        this.id = id;
        this.pairingCode = pairingCode;
    }

    public UUID getId() { return id; }
    public String getPairingCode() { return pairingCode; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public String getNickname() { return nickname; }
    public String getPersonaKey() { return personaKey; }
    public OffsetDateTime getProfileUpdatedAt() { return profileUpdatedAt; }

    public void updateProfile(String nickname, String personaKey) {
        this.nickname = nickname;
        this.personaKey = personaKey;
        this.profileUpdatedAt = OffsetDateTime.now();
    }
}
