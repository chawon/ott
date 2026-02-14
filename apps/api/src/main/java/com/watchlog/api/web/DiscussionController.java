package com.watchlog.api.web;

import com.watchlog.api.dto.CreateDiscussionRequest;
import com.watchlog.api.dto.DiscussionDto;
import com.watchlog.api.dto.DiscussionListItemDto;
import com.watchlog.api.service.DiscussionService;
import com.watchlog.api.service.TitleService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/discussions")
public class DiscussionController {

    private final DiscussionService discussionService;
    private final TitleService titleService;

    public DiscussionController(DiscussionService discussionService, TitleService titleService) {
        this.discussionService = discussionService;
        this.titleService = titleService;
    }

    @GetMapping
    public DiscussionDto getByTitle(@RequestParam("titleId") UUID titleId) {
        var discussion = discussionService.findByTitle(titleId);
        return discussion == null ? null : DiscussionDto.from(discussion);
    }

    @GetMapping("/{id}")
    public DiscussionListItemDto get(@PathVariable UUID id) {
        var discussion = discussionService.require(id);
        var posterByTitleId = discussionService.findLatestSeasonPosterUrlByTitleIds(List.of(discussion.getTitle().getId()));
        return DiscussionListItemDto.from(discussion, posterByTitleId.get(discussion.getTitle().getId()));
    }

    @GetMapping("/latest")
    public List<DiscussionListItemDto> latest(
            @RequestParam(value = "limit", defaultValue = "6") int limit,
            @RequestParam(value = "minComments", required = false) Integer minComments,
            @RequestParam(value = "days", required = false) Integer days
    ) {
        var discussions = discussionService.listLatest(limit, minComments, days);
        var posterByTitleId = discussionService.findLatestSeasonPosterUrlByTitleIds(
                discussions.stream().map(d -> d.getTitle().getId()).distinct().toList()
        );
        return discussions.stream()
                .map(d -> DiscussionListItemDto.from(d, posterByTitleId.get(d.getTitle().getId())))
                .toList();
    }

    @GetMapping("/all")
    public List<DiscussionListItemDto> all(@RequestParam(value = "limit", defaultValue = "100") int limit) {
        var discussions = discussionService.listLatest(limit);
        var posterByTitleId = discussionService.findLatestSeasonPosterUrlByTitleIds(
                discussions.stream().map(d -> d.getTitle().getId()).distinct().toList()
        );
        return discussions.stream()
                .map(d -> DiscussionListItemDto.from(d, posterByTitleId.get(d.getTitle().getId())))
                .toList();
    }

    @PostMapping
    public DiscussionDto create(@RequestBody CreateDiscussionRequest req) {
        var title = titleService.require(req.titleId());
        return DiscussionDto.from(discussionService.ensureForTitle(title));
    }
}
