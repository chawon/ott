package com.watchlog.api.dto;

public record AuthPairRequest(
        String code,
        java.util.UUID oldUserId
) {}
