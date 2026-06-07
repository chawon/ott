package com.watchlog.api.dto;

public record AndroidReminderNextRequest(
        String installToken,
        String timeZone,
        String locale,
        Boolean notificationPermissionGranted,
        String versionName,
        Integer versionCode
) {}
