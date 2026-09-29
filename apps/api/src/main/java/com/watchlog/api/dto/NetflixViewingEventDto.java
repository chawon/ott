package com.watchlog.api.dto;

import java.time.LocalDate;
import java.util.UUID;

public record NetflixViewingEventDto(
        UUID id,
        String sourceKey,
        String rawTitle,
        String workTitle,
        LocalDate viewedOn,
        int occurrence,
        Integer seasonNumber,
        Integer episodeNumber,
        UUID linkedTitleId
) {}
