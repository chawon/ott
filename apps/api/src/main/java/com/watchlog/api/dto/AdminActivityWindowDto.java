package com.watchlog.api.dto;

public record AdminActivityWindowDto(
        long rawAppOpenEvents,
        long appOpenSessions,
        long activeClients,
        long qualifiedActors
) {}
