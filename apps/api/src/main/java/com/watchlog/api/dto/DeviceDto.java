package com.watchlog.api.dto;

import com.watchlog.api.domain.UserDeviceEntity;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DeviceDto(
        UUID id,
        OffsetDateTime createdAt,
        OffsetDateTime lastSeenAt,
        String os,
        String browser
) {
    public static DeviceDto from(UserDeviceEntity e) {
        return new DeviceDto(e.getId(), e.getCreatedAt(), e.getLastSeenAt(), e.getOs(), e.getBrowser());
    }
}
