package com.watchlog.api.service;

import com.watchlog.api.dto.DailyReportDto.CloudflareStatsDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

@Service
public class CloudflareAnalyticsService {

    private static final Logger log = LoggerFactory.getLogger(CloudflareAnalyticsService.class);
    private static final String CF_GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";

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
            LocalDate yesterday = LocalDate.now(ZoneId.of("Asia/Seoul")).minusDays(1);
            String date = yesterday.toString();

            String query = """
                {
                  viewer {
                    zones(filter: {zoneTag: "%s"}) {
                      httpRequests1dGroups(
                        limit: 1
                        filter: {date: "%s"}
                      ) {
                        sum {
                          requests
                          pageViews
                        }
                      }
                    }
                    accounts(filter: {accountTag: "%s"}) {
                      rumPageloadEventsAdaptiveGroups(
                        limit: 1
                        filter: {date: "%s", requestHost: "%s"}
                      ) {
                        sum {
                          visits
                        }
                      }
                    }
                  }
                }
                """.formatted(zoneId, date, accountTag, date, requestHost);

            var client = RestClient.create();
            @SuppressWarnings("unchecked")
            Map<String, Object> response = client.post()
                    .uri(CF_GRAPHQL)
                    .header("Authorization", "Bearer " + apiToken)
                    .header("Content-Type", "application/json")
                    .body(Map.of("query", query))
                    .retrieve()
                    .body(Map.class);

            return parseResponse(response);
        } catch (Exception e) {
            log.warn("Cloudflare API call failed", e);
            return new CloudflareStatsDto(0, 0, 0, e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private CloudflareStatsDto parseResponse(Map<String, Object> response) {
        try {
            var data = (Map<String, Object>) response.get("data");
            var viewer = (Map<String, Object>) data.get("viewer");

            // Zone analytics: requests, pageViews
            var zones = (List<Map<String, Object>>) viewer.get("zones");
            long requests = 0, pageViews = 0;
            if (zones != null && !zones.isEmpty()) {
                var httpGroups = (List<Map<String, Object>>) zones.get(0).get("httpRequests1dGroups");
                if (httpGroups != null && !httpGroups.isEmpty()) {
                    var sum = (Map<String, Object>) httpGroups.get(0).get("sum");
                    requests = toLong(sum.get("requests"));
                    pageViews = toLong(sum.get("pageViews"));
                }
            }

            // Web Analytics (RUM): actual browser visits via account-level query
            var accounts = (List<Map<String, Object>>) viewer.get("accounts");
            long uniqueVisitors = 0;
            if (accounts != null && !accounts.isEmpty()) {
                var rumGroups = (List<Map<String, Object>>) accounts.get(0).get("rumPageloadEventsAdaptiveGroups");
                if (rumGroups != null && !rumGroups.isEmpty()) {
                    var sum = (Map<String, Object>) rumGroups.get(0).get("sum");
                    uniqueVisitors = toLong(sum.get("visits"));
                }
            }

            return new CloudflareStatsDto(requests, uniqueVisitors, pageViews, null);
        } catch (Exception e) {
            log.warn("Failed to parse Cloudflare response", e);
            return new CloudflareStatsDto(0, 0, 0, "Parse error: " + e.getMessage());
        }
    }

    private long toLong(Object value) {
        if (value == null) return 0;
        if (value instanceof Number n) return n.longValue();
        return Long.parseLong(value.toString());
    }
}
