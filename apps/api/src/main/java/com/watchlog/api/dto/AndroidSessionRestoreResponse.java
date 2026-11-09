package com.watchlog.api.dto;

import java.util.UUID;

public record AndroidSessionRestoreResponse(
        boolean found,
        UUID userId,
        UUID deviceId,
        String pairingCode,
        String nickname,
        String personaKey
) {
    public static AndroidSessionRestoreResponse empty() {
        return new AndroidSessionRestoreResponse(false, null, null, null, null, null);
    }
}
