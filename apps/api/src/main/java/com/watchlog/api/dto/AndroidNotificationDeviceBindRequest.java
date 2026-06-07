package com.watchlog.api.dto;

public record AndroidNotificationDeviceBindRequest(
        String installToken,
        String versionName,
        Integer versionCode,
        Boolean notificationPermissionGranted,
        Boolean revisitRemindersEnabled
) {}
