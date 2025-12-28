package com.watchlog.api.web;

import com.watchlog.api.dto.CommentDto;
import com.watchlog.api.dto.CreateCommentRequest;
import com.watchlog.api.service.CommentService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/discussions/{discussionId}/comments")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
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
            @RequestBody CreateCommentRequest req
    ) {
        return CommentDto.from(commentService.create(discussionId, req.body(), req.userId(), req.mentions()));
    }
}
