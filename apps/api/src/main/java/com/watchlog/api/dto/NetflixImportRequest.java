package com.watchlog.api.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record NetflixImportRequest(List<Row> rows) {
    public record Row(
            String rawTitle,
            String workTitle,
            LocalDate viewedOn,
            Integer occurrence,
            Integer seasonNumber,
            Integer episodeNumber,
            UUID linkedTitleId
    ) {}
}
