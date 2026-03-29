package com.watchlog.api.service;

import com.watchlog.api.dto.DailyReportDto;
import com.watchlog.api.dto.DailyReportDto.InternalStatsDto;
import com.watchlog.api.notify.TelegramProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Locale;
import java.util.Map;

@Service
public class DailyReportService {

    private static final Logger log = LoggerFactory.getLogger(DailyReportService.class);

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final String EXCLUDED_ADMIN_ID = "1";

    private final JdbcTemplate jdbcTemplate;
    private final CloudflareAnalyticsService cloudflareService;
    private final GoogleAnalyticsService ga4Service;
    private final KubernetesStatusService k8sService;
    private final RestClient telegramRestClient;
    private final TelegramProperties telegramProperties;

    @Value("${admin.analytics.token:}")
    private String adminToken;

    public DailyReportService(
            JdbcTemplate jdbcTemplate,
            CloudflareAnalyticsService cloudflareService,
            GoogleAnalyticsService ga4Service,
            KubernetesStatusService k8sService,
            @Qualifier("telegramRestClient") RestClient telegramRestClient,
            TelegramProperties telegramProperties
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.cloudflareService = cloudflareService;
        this.ga4Service = ga4Service;
        this.k8sService = k8sService;
        this.telegramRestClient = telegramRestClient;
        this.telegramProperties = telegramProperties;
    }

    public DailyReportDto buildReport() {
        LocalDate yesterday = LocalDate.now(KST).minusDays(1);
        String date = yesterday.toString();

        ZonedDateTime from = yesterday.atStartOfDay(KST);
        ZonedDateTime to = from.plusDays(1);

        var cf = cloudflareService.fetchYesterday();
        var ga4 = ga4Service.fetchYesterday();
        var k8s = k8sService.fetchStatus();
        var internal = buildInternalStats(from, to);

        return new DailyReportDto(date, cf, ga4, internal, k8s);
    }

    private InternalStatsDto buildInternalStats(ZonedDateTime from, ZonedDateTime to) {
        long dau = countDistinctActors("app_open", from, to);
        long logCreate = countDistinctActors("log_create", from, to);
        long newDevices = countDistinctActors("login_success", from, to);
        return new InternalStatsDto(dau, logCreate, newDevices);
    }

    private long countDistinctActors(String eventName, ZonedDateTime from, ZonedDateTime to) {
        Long value = jdbcTemplate.queryForObject("""
                select count(distinct coalesce(client_id::text, user_id::text, session_id))
                from analytics_events
                where event_name = ? and occurred_at >= ? and occurred_at < ?
                  and (user_id is null or user_id::text != ?)
                """, Long.class, eventName, from.toOffsetDateTime(), to.toOffsetDateTime(), EXCLUDED_ADMIN_ID);
        return value == null ? 0L : value;
    }

    public void sendTelegram(DailyReportDto report) {
        if (!telegramProperties.isConfigured()) {
            log.info("Telegram not configured, skipping daily report");
            return;
        }
        try {
            telegramRestClient.post()
                    .uri("/bot{token}/sendMessage", telegramProperties.botToken())
                    .body(Map.of(
                            "chat_id", telegramProperties.chatId(),
                            "text", formatMessage(report),
                            "parse_mode", "HTML",
                            "disable_web_page_preview", true
                    ))
                    .retrieve()
                    .toBodilessEntity();
            log.info("Daily report sent to Telegram");
        } catch (Exception e) {
            log.warn("Failed to send daily report to Telegram", e);
        }
    }

    public void verifyToken(String token) {
        if (adminToken == null || adminToken.isBlank() || !adminToken.equals(token)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNAUTHORIZED, "Invalid admin token");
        }
    }

    @Scheduled(cron = "${report.schedule:0 0 0 * * *}")
    public void scheduledSend() {
        log.info("Sending daily operations report...");
        sendTelegram(buildReport());
    }

    private String formatMessage(DailyReportDto r) {
        var cf = r.cloudflare();
        var ga4 = r.ga4();
        var internal = r.internal();
        var k8s = r.kubernetes();

        StringBuilder sb = new StringBuilder();
        sb.append("<b>📊 ottline 데일리 리포트 (").append(r.date()).append(")</b>\n\n");

        sb.append("<b>🌐 트래픽 (Cloudflare)</b>\n");
        if (cf.error() != null) {
            sb.append("• 연동 오류: ").append(cf.error()).append("\n");
        } else {
            sb.append("• 요청: ").append(fmt(cf.requests()))
              .append(" | 방문자: ").append(fmt(cf.uniqueVisitors()))
              .append(" | 페이지뷰: ").append(fmt(cf.pageViews())).append("\n");
        }

        sb.append("\n<b>📈 사용자 (GA4)</b>\n");
        if (ga4.error() != null) {
            sb.append("• 연동 오류: ").append(ga4.error()).append("\n");
        } else {
            sb.append("• 세션: ").append(fmt(ga4.sessions()))
              .append(" | 활성: ").append(fmt(ga4.activeUsers())).append("\n");
            sb.append("• 페이지뷰: ").append(fmt(ga4.pageViews()))
              .append(" | 신규: ").append(fmt(ga4.newUsers())).append("\n");
        }

        sb.append("\n<b>🎯 앱 활동 (내부)</b>\n");
        sb.append("• DAU: ").append(fmt(internal.dau()))
          .append(" | 로그 생성: ").append(fmt(internal.logCreate())).append("\n");
        sb.append("• 신규 기기: ").append(fmt(internal.newDevices())).append("\n");

        sb.append("\n<b>☸️ 인프라 (K8s / ott)</b>\n");
        if (k8s.error() != null) {
            sb.append("• 연동 오류: ").append(k8s.error()).append("\n");
        } else if (k8s.pods().isEmpty()) {
            sb.append("• Pod 없음\n");
        } else {
            for (var pod : k8s.pods()) {
                String status = "Running".equals(pod.phase()) ? "✅" : "⚠️";
                sb.append("• ").append(status).append(" ").append(pod.name());
                if (pod.imageTag() != null) sb.append(" [").append(pod.imageTag()).append("]");
                if (pod.cpuUsage() != null) sb.append("\n  CPU: ").append(pod.cpuUsage()).append(" | Mem: ").append(pod.memoryUsage());
                sb.append("\n");
            }
        }

        return sb.toString();
    }

    private String fmt(long v) {
        return NumberFormat.getNumberInstance(Locale.KOREA).format(v);
    }
}
