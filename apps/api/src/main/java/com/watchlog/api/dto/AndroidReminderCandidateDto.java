package com.watchlog.api.dto;

import java.util.UUID;

public record AndroidReminderCandidateDto(
        UUID deliveryId,
        String reminderType,
        String title,
        String body,
        String deepLink
) {}
