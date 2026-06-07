package com.watchlog.api.dto;

public record AndroidNotificationDeviceBindResponse(
        boolean bound,
        boolean revisitRemindersEnabled
) {}
