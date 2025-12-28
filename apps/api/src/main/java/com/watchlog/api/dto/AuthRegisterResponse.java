package com.watchlog.api.dto;

import java.util.UUID;

public record AuthRegisterResponse(
        UUID userId,
        UUID deviceId,
        String pairingCode
) {}
