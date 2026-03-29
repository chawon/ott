package com.watchlog.api.web;

import com.watchlog.api.dto.DailyReportDto;
import com.watchlog.api.service.DailyReportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/report")
public class AdminDailyReportController {

    private final DailyReportService reportService;

    public AdminDailyReportController(DailyReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/daily")
    public DailyReportDto daily(
            @RequestHeader(value = "X-Admin-Token", required = false) String token
    ) {
        reportService.verifyToken(token);
        return reportService.buildReport();
    }

    @PostMapping("/daily/send")
    public ResponseEntity<Void> sendNow(
            @RequestHeader(value = "X-Admin-Token", required = false) String token
    ) {
        reportService.verifyToken(token);
        DailyReportDto report = reportService.buildReport();
        reportService.sendTelegram(report);
        return ResponseEntity.ok().build();
    }
}
