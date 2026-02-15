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
        var seasonMetaByTitleId = discussionService.findLatestSeasonMetaByTitleIds(List.of(discussion.getTitle().getId()));
        var meta = seasonMetaByTitleId.get(discussion.getTitle().getId());
        return DiscussionListItemDto.from(discussion, meta == null ? null : meta.posterUrl(), meta == null ? null : meta.seasonYear());
    }

    @GetMapping("/latest")
    public List<DiscussionListItemDto> latest(
            @RequestParam(value = "limit", defaultValue = "6") int limit,
            @RequestParam(value = "minComments", required = false) Integer minComments,
            @RequestParam(value = "days", required = false) Integer days
    ) {
        var discussions = discussionService.listLatest(limit, minComments, days);
        var seasonMetaByTitleId = discussionService.findLatestSeasonMetaByTitleIds(
                discussions.stream().map(d -> d.getTitle().getId()).distinct().toList()
        );
        return discussions.stream()
                .map(d -> {
                    var meta = seasonMetaByTitleId.get(d.getTitle().getId());
                    return DiscussionListItemDto.from(d, meta == null ? null : meta.posterUrl(), meta == null ? null : meta.seasonYear());
                })
                .toList();
    }

    @GetMapping("/all")
    public List<DiscussionListItemDto> all(@RequestParam(value = "limit", defaultValue = "100") int limit) {
        var discussions = discussionService.listLatest(limit);
        var seasonMetaByTitleId = discussionService.findLatestSeasonMetaByTitleIds(
                discussions.stream().map(d -> d.getTitle().getId()).distinct().toList()
        );
        return discussions.stream()
                .map(d -> {
                    var meta = seasonMetaByTitleId.get(d.getTitle().getId());
                    return DiscussionListItemDto.from(d, meta == null ? null : meta.posterUrl(), meta == null ? null : meta.seasonYear());
                })
                .toList();
    }

    @PostMapping
    public DiscussionDto create(@RequestBody CreateDiscussionRequest req) {
        var title = titleService.require(req.titleId());
        return DiscussionDto.from(discussionService.ensureForTitle(title));
    }
}
