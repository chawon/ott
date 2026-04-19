package com.watchlog.api.dto;

public record ChatGptTokenResponse(
        String access_token,
        String token_type,
        long expires_in,
        String scope
) {}
