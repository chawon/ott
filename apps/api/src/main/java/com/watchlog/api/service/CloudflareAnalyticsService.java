package com.watchlog.api.service;

import com.watchlog.api.dto.DailyReportDto.CloudflareStatsDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

@Service
public class CloudflareAnalyticsService {

    private static final Logger log = LoggerFactory.getLogger(CloudflareAnalyticsService.class);
    private static final String CF_GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    static final String DAILY_QUERY = """
            query DailyCloudflareStats(
              $zoneTag: string
              $accountTag: string
              $requestHost: string
              $start: Time
              $end: Time
            ) {
              viewer {
                zones(filter: {zoneTag: $zoneTag}) {
                  httpRequests1hGroups(
                    limit: 100
                    filter: {datetime_geq: $start, datetime_lt: $end}
                  ) {
                    sum {
                      requests
                      pageViews
                    }
                  }
                }
                accounts(filter: {accountTag: $accountTag}) {
                  rumPageloadEventsAdaptiveGroups(
                    limit: 100
                    filter: {
                      datetime_geq: $start
                      datetime_lt: $end
                      requestHost: $requestHost
                    }
                  ) {
                    sum {
                      visits
                    }
                  }
                }
              }
            }
            """;

    @Value("${cloudflare.api-token:}")
    private String apiToken;

    @Value("${cloudflare.zone-id:}")
    private String zoneId;

    @Value("${cloudflare.account-tag:}")
    private String accountTag;

    @Value("${cloudflare.request-host:}")
    private String requestHost;

    public CloudflareStatsDto fetchYesterday() {
        if (apiToken.isBlank() || zoneId.isBlank()) {
            return new CloudflareStatsDto(0, 0, 0, "CF_API_TOKEN or CF_ZONE_ID not configured");
        }
        try {
            LocalDate yesterday = LocalDate.now(KST).minusDays(1);
            KstDayRange range = kstDayRange(yesterday);
            Map<String, Object> variables = Map.of(
                    "zoneTag", zoneId,
                    "accountTag", accountTag,
                    "requestHost", requestHost,
                    "start", range.start().toString(),
                    "end", range.end().toString()
            );

            var client = RestClient.create();
            @SuppressWarnings("unchecked")
            Map<String, Object> response = client.post()
                    .uri(CF_GRAPHQL)
                    .header("Authorization", "Bearer " + apiToken)
                    .header("Content-Type", "application/json")
                    .body(Map.of("query", DAILY_QUERY, "variables", variables))
                    .retrieve()
                    .body(Map.class);

            return parseResponse(response);
        } catch (Exception e) {
            log.warn("Cloudflare API call failed", e);
            return new CloudflareStatsDto(0, 0, 0, e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    CloudflareStatsDto parseResponse(Map<String, Object> response) {
        try {
            var data = (Map<String, Object>) response.get("data");
            var viewer = (Map<String, Object>) data.get("viewer");

            // Zone analytics: requests, pageViews
            var zones = (List<Map<String, Object>>) viewer.get("zones");
            long requests = 0, pageViews = 0;
            if (zones != null && !zones.isEmpty()) {
                var httpGroups = (List<Map<String, Object>>) zones.get(0).get("httpRequests1hGroups");
                requests = sumGroups(httpGroups, "requests");
                pageViews = sumGroups(httpGroups, "pageViews");
            }

            // Web Analytics (RUM): actual browser visits via account-level query
            var accounts = (List<Map<String, Object>>) viewer.get("accounts");
            long visits = 0;
            if (accounts != null && !accounts.isEmpty()) {
                var rumGroups = (List<Map<String, Object>>) accounts.get(0).get("rumPageloadEventsAdaptiveGroups");
                visits = sumGroups(rumGroups, "visits");
            }

            return new CloudflareStatsDto(requests, visits, pageViews, null);
        } catch (Exception e) {
            log.warn("Failed to parse Cloudflare response", e);
            return new CloudflareStatsDto(0, 0, 0, "Parse error: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private long sumGroups(List<Map<String, Object>> groups, String field) {
        if (groups == null || groups.isEmpty()) return 0;
        long total = 0;
        for (Map<String, Object> group : groups) {
            var sum = (Map<String, Object>) group.get("sum");
            if (sum != null) total += toLong(sum.get(field));
        }
        return total;
    }

    static KstDayRange kstDayRange(LocalDate date) {
        Instant start = date.atStartOfDay(KST).toInstant();
        Instant end = date.plusDays(1).atStartOfDay(KST).toInstant();
        return new KstDayRange(start, end);
    }

    record KstDayRange(Instant start, Instant end) {}

    private long toLong(Object value) {
        if (value == null) return 0;
        if (value instanceof Number n) return n.longValue();
        return Long.parseLong(value.toString());
    }
}
