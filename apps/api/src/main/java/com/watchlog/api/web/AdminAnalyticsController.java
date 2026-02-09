package com.watchlog.api.web;

import com.watchlog.api.dto.AdminAnalyticsOverviewDto;
import com.watchlog.api.service.AnalyticsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/analytics")
public class AdminAnalyticsController {

    private final AnalyticsService analyticsService;

    public AdminAnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/overview")
    public AdminAnalyticsOverviewDto overview(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @RequestParam(value = "days", defaultValue = "30") int days
    ) {
        return analyticsService.adminOverview(token, days);
    }
}
