package com.watchlog.api.dto;

public record AdminEventBreakdownDto(
        String eventName,
        long events,
        long actors
) {}
