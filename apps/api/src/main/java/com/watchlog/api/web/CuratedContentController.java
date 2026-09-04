package com.watchlog.api.web;

import com.watchlog.api.dto.CuratedContentDto;
import com.watchlog.api.service.CuratedContentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/curated-contents")
public class CuratedContentController {

    private final CuratedContentService curatedContentService;

    public CuratedContentController(CuratedContentService curatedContentService) {
        this.curatedContentService = curatedContentService;
    }

    @GetMapping
    public List<CuratedContentDto> list(
            @RequestHeader(value = "Accept-Language", defaultValue = "ko") String language,
            @RequestParam(value = "limit", defaultValue = "6") int limit
    ) {
        return curatedContentService.listPublished(language, limit);
    }
}
