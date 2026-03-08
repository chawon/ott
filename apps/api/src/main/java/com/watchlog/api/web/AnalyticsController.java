package com.watchlog.api.web;

import com.watchlog.api.dto.PersonalAnalyticsReportDto;
import com.watchlog.api.dto.TrackAnalyticsEventRequest;
import com.watchlog.api.dto.TrackAnalyticsEventResponse;
import com.watchlog.api.service.AuthService;
import com.watchlog.api.service.AnalyticsService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final AuthService authService;

    public AnalyticsController(AnalyticsService analyticsService, AuthService authService) {
        this.analyticsService = analyticsService;
        this.authService = authService;
    }

    @PostMapping("/events")
    public TrackAnalyticsEventResponse trackEvent(
            @Valid @RequestBody TrackAnalyticsEventRequest req,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
            @RequestHeader(value = "X-Client-Id", required = false) UUID clientId
    ) {
        return analyticsService.trackEvent(req, userId, clientId);
    }

    @GetMapping("/me/report")
    public PersonalAnalyticsReportDto personalReport(
            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) UUID deviceId
    ) {
        authService.requireActiveDevice(userId, deviceId);
        return analyticsService.personalReport(userId);
    }
}
