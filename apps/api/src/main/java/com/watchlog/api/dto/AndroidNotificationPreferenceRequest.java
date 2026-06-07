package com.watchlog.api.dto;

public record AndroidNotificationPreferenceRequest(
        String installToken,
        Boolean notificationPermissionGranted,
        Boolean revisitRemindersEnabled,
        String versionName,
        Integer versionCode
) {}
