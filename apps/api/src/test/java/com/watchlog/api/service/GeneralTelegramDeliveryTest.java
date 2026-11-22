package com.watchlog.api.service;

import com.watchlog.api.domain.*;
import com.watchlog.api.dto.*;
import com.watchlog.api.notify.TelegramProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GeneralTelegramDeliveryTest {
    private final RestClient.Builder builder = RestClient.builder().baseUrl("https://telegram.invalid");
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final RestClient client = builder.build();
    private final TelegramProperties properties = new TelegramProperties(true, "test-token", "test-chat",
            "https://telegram.invalid", "ottline-test");

    @Test
    void feedbackNotificationStillUsesTheGeneralSendMessageClient() {
        server.expect(requestTo("https://telegram.invalid/bottest-token/sendMessage"))
                .andExpect(method(HttpMethod.POST)).andExpect(jsonPath("$.chat_id").value("test-chat"))
                .andExpect(jsonPath("$.text").value(containsString("test inquiry")))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        var thread = new FeedbackThreadEntity(UUID.randomUUID(), UUID.randomUUID(), FeedbackCategory.QUESTION, "test inquiry");
        var message = new FeedbackMessageEntity(UUID.randomUUID(), thread, FeedbackAuthorRole.USER, "test body");

        new FeedbackTelegramNotifier(client, properties).notifyNewThread(thread, message);

        server.verify();
    }

    @Test
    void dailyReportStillUsesTheGeneralSendMessageClient() {
        server.expect(requestTo("https://telegram.invalid/bottest-token/sendMessage"))
                .andExpect(method(HttpMethod.POST)).andExpect(jsonPath("$.chat_id").value("test-chat"))
                .andExpect(jsonPath("$.parse_mode").value("HTML"))
                .andExpect(jsonPath("$.text").value(containsString("2026-11-21")))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        var report = new DailyReportDto("2026-11-21", OffsetDateTime.parse("2026-11-22T09:00:00+09:00"),
                new DailyReportDto.CloudflareStatsDto(10, 2, 3, null),
                new DailyReportDto.Ga4StatsDto(2, 2, 3, 0, null),
                new DailyReportDto.InternalStatsDto(2, 1, 1, 1, 1, 1, 1,
                        new AdminActivityWindowDto(2, 2, 2, 2), new AdminReachSummaryDto(1, 1, 1, 1, 1)),
                new DailyReportDto.K8sStatusDto(List.of(), null));

        new DailyReportService(null, null, null, null, null, client, properties).sendTelegram(report);

        server.verify();
    }
}
