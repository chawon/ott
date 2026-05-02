package com.watchlog.api.web;

import com.watchlog.api.dto.CommentDto;
import com.watchlog.api.dto.CreateCommentRequest;
import com.watchlog.api.service.AuthService;
import com.watchlog.api.service.CommentService;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/discussions/{discussionId}/comments")
public class CommentController {

    private final CommentService commentService;
    private final AuthService authService;

    public CommentController(CommentService commentService, AuthService authService) {
        this.commentService = commentService;
        this.authService = authService;
    }

    @GetMapping
    public List<CommentDto> list(
            @PathVariable UUID discussionId,
            @RequestParam(value = "limit", defaultValue = "50") int limit
    ) {
        return commentService.list(discussionId, limit).stream()
                .map(CommentDto::from)
                .toList();
    }

    @PostMapping
    public CommentDto create(
            @PathVariable UUID discussionId,
            @RequestBody CreateCommentRequest req,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) UUID deviceId,
            @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String language
    ) {
        authService.requireActiveDevice(userId, deviceId);
        boolean syncLog = req.syncLog() == null || req.syncLog();
        return CommentDto.from(commentService.create(discussionId, req.body(), userId, req.mentions(), syncLog, language));
    }
}
