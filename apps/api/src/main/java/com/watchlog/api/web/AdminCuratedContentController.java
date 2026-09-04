package com.watchlog.api.web;

import com.watchlog.api.dto.CreateCuratedDraftRequest;
import com.watchlog.api.dto.CuratedContentAdminDto;
import com.watchlog.api.dto.CuratedTitleOptionDto;
import com.watchlog.api.service.CuratedContentAdminService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/internal/admin/curated-contents")
public class AdminCuratedContentController {

    private final CuratedContentAdminService service;

    public AdminCuratedContentController(CuratedContentAdminService service) {
        this.service = service;
    }

    @GetMapping
    public List<CuratedContentAdminDto> list(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String locale,
            @RequestParam(defaultValue = "50") int limit
    ) {
        return service.list(token, status, locale, limit);
    }

    @PostMapping("/drafts")
    public CuratedContentAdminDto createDraft(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @Valid @RequestBody CreateCuratedDraftRequest request
    ) {
        return service.createDraft(token, request);
    }

    @GetMapping("/titles")
    public List<CuratedTitleOptionDto> searchTitles(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return service.searchTitles(token, q, limit);
    }

    @PostMapping("/{id}/publish")
    public CuratedContentAdminDto publish(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @PathVariable UUID id
    ) {
        return service.publish(token, id);
    }

    @PostMapping("/{id}/disable")
    public CuratedContentAdminDto disable(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @PathVariable UUID id
    ) {
        return service.disable(token, id);
    }
}
