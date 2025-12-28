package com.watchlog.api.dto;

import java.util.UUID;

public record AuthPairResponse(
        UUID userId,
        UUID deviceId,
        String pairingCode
) {}
