package com.watchlog.api.service;

import com.watchlog.api.dto.AdminActivityWindowDto;
import com.watchlog.api.dto.AdminReachSummaryDto;
import com.watchlog.api.dto.DailyReportDto;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DailyReportServiceTest {

    @Test
    void labelsMetricsByTheirActualMeaningAndSnapshotState() {
        var activity = new AdminActivityWindowDto(12, 10, 9, 8);
        var reach = new AdminReachSummaryDto(7, 6, 5, 4, 3);
        var report = new DailyReportDto(
                "2026-08-02",
                OffsetDateTime.parse("2026-08-03T14:35:00+09:00"),
                new DailyReportDto.CloudflareStatsDto(1_105, 8, 248, null),
                new DailyReportDto.Ga4StatsDto(20, 15, 30, 4, null),
                new DailyReportDto.InternalStatsDto(8, 7, 6, 5, 4, 3, 2, activity, reach),
                new DailyReportDto.K8sStatusDto(
                        List.of(new DailyReportDto.PodStatusDto(
                                "ott-api-abc", "Running", "abcdef0", "10m", "512Mi"
                        )),
                        null
                )
        );

        String message = DailyReportService.formatMessage(report);

        assertThat(message)
                .contains("요청: 1,105 | 방문: 8 | 페이지뷰: 248")
                .doesNotContain("방문자")
                .contains("사용자 (GA4 · 잠정치)")
                .contains("전일 값은 조회 시점 기준 잠정치이며 이후 보정될 수 있어요.")
                .contains("인프라 (K8s · 14:35 KST 현재)");
    }
}
