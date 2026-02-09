package com.watchlog.api.web;

import com.watchlog.api.dto.PersonalAnalyticsReportDto;
import com.watchlog.api.dto.TrackAnalyticsEventRequest;
import com.watchlog.api.dto.TrackAnalyticsEventResponse;
import com.watchlog.api.service.AnalyticsService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @PostMapping("/events")
    public TrackAnalyticsEventResponse trackEvent(
            @Valid @RequestBody TrackAnalyticsEventRequest req,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId
    ) {
        return analyticsService.trackEvent(req, userId);
    }

    @GetMapping("/me/report")
    public PersonalAnalyticsReportDto personalReport(
            @RequestHeader(value = "X-User-Id", required = false) UUID userId
    ) {
        return analyticsService.personalReport(userId);
    }
}
