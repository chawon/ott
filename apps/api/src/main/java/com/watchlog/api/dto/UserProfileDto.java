package com.watchlog.api.dto;

import com.watchlog.api.domain.UserEntity;

import java.time.OffsetDateTime;
import java.util.UUID;

public record UserProfileDto(
        UUID userId,
        String nickname,
        String personaKey,
        OffsetDateTime profileUpdatedAt
) {
    public static UserProfileDto from(UserEntity user) {
        return new UserProfileDto(
                user.getId(),
                user.getNickname(),
                user.getPersonaKey(),
                user.getProfileUpdatedAt()
        );
    }
}
