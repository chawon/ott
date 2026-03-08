package com.watchlog.api.web;

import com.watchlog.api.dto.CreateFeedbackThreadRequest;
import com.watchlog.api.dto.FeedbackThreadDetailDto;
import com.watchlog.api.dto.FeedbackThreadSummaryDto;
import com.watchlog.api.service.AuthService;
import com.watchlog.api.service.FeedbackService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    private final FeedbackService feedbackService;
    private final AuthService authService;

    public FeedbackController(FeedbackService feedbackService, AuthService authService) {
        this.feedbackService = feedbackService;
        this.authService = authService;
    }

    @GetMapping("/threads")
    public List<FeedbackThreadSummaryDto> list(
            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) UUID deviceId
    ) {
        authService.requireActiveDevice(userId, deviceId);
        return feedbackService.listOwnThreads(userId);
    }

    @PostMapping("/threads")
    public FeedbackThreadDetailDto create(
            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) UUID deviceId,
            @RequestBody CreateFeedbackThreadRequest req
    ) {
        authService.requireActiveDevice(userId, deviceId);
        return feedbackService.createThread(userId, req.category(), req.subject(), req.body());
    }

    @GetMapping("/threads/{id}")
    public FeedbackThreadDetailDto get(
            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) UUID deviceId,
            @PathVariable UUID id
    ) {
        authService.requireActiveDevice(userId, deviceId);
        return feedbackService.getOwnThread(userId, id);
    }
}
