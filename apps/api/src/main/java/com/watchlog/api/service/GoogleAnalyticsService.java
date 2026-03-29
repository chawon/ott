package com.watchlog.api.service;

import com.google.auth.oauth2.GoogleCredentials;
import com.watchlog.api.dto.DailyReportDto.Ga4StatsDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

@Service
public class GoogleAnalyticsService {

    private static final Logger log = LoggerFactory.getLogger(GoogleAnalyticsService.class);
    private static final String GA4_BASE = "https://analyticsdata.googleapis.com/v1beta";
    private static final List<String> SCOPES = List.of("https://www.googleapis.com/auth/analytics.readonly");

    @Value("${google-analytics.property-id:}")
    private String propertyId;

    @Value("${google-analytics.credentials-json:}")
    private String credentialsJson;

    public Ga4StatsDto fetchYesterday() {
        if (propertyId.isBlank() || credentialsJson.isBlank()) {
            return new Ga4StatsDto(0, 0, 0, 0, "GA4_PROPERTY_ID or GA4_CREDENTIALS_JSON not configured");
        }
        try {
            String accessToken = getAccessToken();
            LocalDate yesterday = LocalDate.now(ZoneId.of("Asia/Seoul")).minusDays(1);
            String date = yesterday.toString();

            var body = Map.of(
                    "dateRanges", List.of(Map.of("startDate", date, "endDate", date)),
                    "metrics", List.of(
                            Map.of("name", "sessions"),
                            Map.of("name", "activeUsers"),
                            Map.of("name", "screenPageViews"),
                            Map.of("name", "newUsers")
                    )
            );

            var client = RestClient.create();
            @SuppressWarnings("unchecked")
            Map<String, Object> response = client.post()
                    .uri(GA4_BASE + "/properties/" + propertyId + ":runReport")
                    .header("Authorization", "Bearer " + accessToken)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            return parseResponse(response);
        } catch (Exception e) {
            log.warn("GA4 API call failed", e);
            return new Ga4StatsDto(0, 0, 0, 0, e.getMessage());
        }
    }

    private String getAccessToken() throws Exception {
        byte[] credBytes = credentialsJson.getBytes(StandardCharsets.UTF_8);
        GoogleCredentials credentials = GoogleCredentials
                .fromStream(new ByteArrayInputStream(credBytes))
                .createScoped(SCOPES);
        credentials.refreshIfExpired();
        return credentials.getAccessToken().getTokenValue();
    }

    @SuppressWarnings("unchecked")
    private Ga4StatsDto parseResponse(Map<String, Object> response) {
        try {
            var rows = (List<Map<String, Object>>) response.get("rows");
            if (rows == null || rows.isEmpty()) return new Ga4StatsDto(0, 0, 0, 0, null);

            var values = (List<Map<String, Object>>) rows.get(0).get("metricValues");
            long sessions   = metricValue(values, 0);
            long activeUsers = metricValue(values, 1);
            long pageViews  = metricValue(values, 2);
            long newUsers   = metricValue(values, 3);

            return new Ga4StatsDto(sessions, activeUsers, pageViews, newUsers, null);
        } catch (Exception e) {
            log.warn("Failed to parse GA4 response", e);
            return new Ga4StatsDto(0, 0, 0, 0, "Parse error: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private long metricValue(List<Map<String, Object>> values, int index) {
        if (values == null || index >= values.size()) return 0;
        Object v = values.get(index).get("value");
        if (v == null) return 0;
        return Long.parseLong(v.toString());
    }
}
