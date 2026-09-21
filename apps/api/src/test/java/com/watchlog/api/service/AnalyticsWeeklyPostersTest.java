package com.watchlog.api.service;

import com.watchlog.api.domain.Status;
import com.watchlog.api.domain.TitleEntity;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.domain.WatchLogEntity;
import com.watchlog.api.repo.UserRepository;
import com.watchlog.api.repo.WatchLogRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.DayOfWeek;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AnalyticsWeeklyPostersTest {

    @Test
    void personalReportIncludesPosterCandidatesFromThePreviousWeek() {
        UUID userId = UUID.randomUUID();
        WatchLogRepository watchLogRepository = mock(WatchLogRepository.class);
        AnalyticsService service = new AnalyticsService(
                mock(JdbcTemplate.class),
                mock(AnalyticsMetricsQuery.class),
                mock(AcquisitionAnalyticsQuery.class),
                watchLogRepository,
                mock(UserRepository.class),
                "admin-secret"
        );

        ZoneId kst = ZoneId.of("Asia/Seoul");
        OffsetDateTime now = OffsetDateTime.now(kst);
        var thisMonday = now.toLocalDate()
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        OffsetDateTime previousWeek = thisMonday.minusWeeks(1)
                .plusDays(2)
                .atTime(20, 0)
                .atZone(kst)
                .toOffsetDateTime();

        TitleEntity title = new TitleEntity(UUID.randomUUID(), TitleType.movie, "Poster Movie");
        title.setPosterUrl("https://image.example/poster-movie.jpg");
        WatchLogEntity log = new WatchLogEntity(UUID.randomUUID(), title, Status.DONE);
        log.setUserId(userId);
        log.setWatchedAt(previousWeek);
        when(watchLogRepository.findByUserId(userId)).thenReturn(List.of(log));

        var report = service.personalReport(userId);

        assertThat(report.previousWeekPosters()).singleElement().satisfies(poster -> {
            assertThat(poster.titleId()).isEqualTo(title.getId());
            assertThat(poster.title()).isEqualTo("Poster Movie");
            assertThat(poster.posterUrl()).isEqualTo("https://image.example/poster-movie.jpg");
            assertThat(poster.count()).isEqualTo(1);
        });
    }
}
