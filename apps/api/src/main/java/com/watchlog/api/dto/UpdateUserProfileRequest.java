package com.watchlog.api.dto;

public record UpdateUserProfileRequest(
        String nickname,
        String personaKey
) {}
