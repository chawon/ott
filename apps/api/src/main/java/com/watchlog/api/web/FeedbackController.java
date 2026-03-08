package com.watchlog.api.web;

import com.watchlog.api.dto.CreateFeedbackThreadRequest;
import com.watchlog.api.dto.FeedbackThreadDetailDto;
import com.watchlog.api.dto.FeedbackThreadSummaryDto;
import com.watchlog.api.service.FeedbackService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    private final FeedbackService feedbackService;

    public FeedbackController(FeedbackService feedbackService) {
        this.feedbackService = feedbackService;
    }

    @GetMapping("/threads")
    public List<FeedbackThreadSummaryDto> list(
            @RequestHeader(value = "X-User-Id", required = false) UUID userId
    ) {
        return feedbackService.listOwnThreads(userId);
    }

    @PostMapping("/threads")
    public FeedbackThreadDetailDto create(
            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
            @RequestBody CreateFeedbackThreadRequest req
    ) {
        return feedbackService.createThread(userId, req.category(), req.subject(), req.body());
    }

    @GetMapping("/threads/{id}")
    public FeedbackThreadDetailDto get(
            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
            @PathVariable UUID id
    ) {
        return feedbackService.getOwnThread(userId, id);
    }
}
