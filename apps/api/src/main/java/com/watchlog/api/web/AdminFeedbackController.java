package com.watchlog.api.web;

import com.watchlog.api.dto.CreateFeedbackMessageRequest;
import com.watchlog.api.dto.FeedbackThreadDetailDto;
import com.watchlog.api.dto.FeedbackThreadSummaryDto;
import com.watchlog.api.service.FeedbackService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/feedback")
public class AdminFeedbackController {

    private final FeedbackService feedbackService;

    public AdminFeedbackController(FeedbackService feedbackService) {
        this.feedbackService = feedbackService;
    }

    @GetMapping("/threads")
    public List<FeedbackThreadSummaryDto> list(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @RequestParam(value = "limit", defaultValue = "100") int limit
    ) {
        return feedbackService.listAdminThreads(token, limit);
    }

    @GetMapping("/threads/{id}")
    public FeedbackThreadDetailDto get(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @PathVariable UUID id
    ) {
        return feedbackService.getAdminThread(token, id);
    }

    @PostMapping("/threads/{id}/reply")
    public FeedbackThreadDetailDto reply(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @PathVariable UUID id,
            @RequestBody CreateFeedbackMessageRequest req
    ) {
        return feedbackService.replyAsAdmin(token, id, req.body());
    }
}
