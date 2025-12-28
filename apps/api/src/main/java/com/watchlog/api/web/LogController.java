package com.watchlog.api.web;

import com.watchlog.api.domain.Occasion;
import com.watchlog.api.domain.Place;
import com.watchlog.api.domain.Status;
import com.watchlog.api.dto.CreateWatchLogRequest;
import com.watchlog.api.dto.UpdateWatchLogRequest;
import com.watchlog.api.dto.WatchLogDto;
import com.watchlog.api.service.LogService;
import com.watchlog.api.service.WatchLogHistoryService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/logs")
public class LogController {

    private final LogService logService;
    private final WatchLogHistoryService historyService;

    public LogController(LogService logService, WatchLogHistoryService historyService) {
        this.logService = logService;
        this.historyService = historyService;
    }

    @GetMapping
    public List<WatchLogDto> list(
            @RequestParam(value = "titleId", required = false) UUID titleId,
            @RequestParam(value = "status", required = false) Status status,
            @RequestParam(value = "ott", required = false) String ott,
            @RequestParam(value = "place", required = false) Place place,
            @RequestParam(value = "occasion", required = false) Occasion occasion,
            @RequestParam(value = "limit", defaultValue = "50") int limit,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId
    ) {
        return logService.list(titleId, status, ott, place, occasion, limit, userId).stream().map(WatchLogDto::from).toList();
    }

    @PostMapping
    public WatchLogDto create(
            @Valid @RequestBody CreateWatchLogRequest req,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId
    ) {
        return WatchLogDto.from(logService.create(req, userId));
    }

    @PatchMapping("/{id}")
    public WatchLogDto update(
            @PathVariable UUID id,
            @RequestBody UpdateWatchLogRequest req,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId
    ) {
        return WatchLogDto.from(logService.update(id, req, userId));
    }

    @GetMapping("/{id}/history")
    public List<com.watchlog.api.dto.WatchLogHistoryDto> history(
            @PathVariable java.util.UUID id,
            @RequestParam(value = "limit", defaultValue = "50") int limit
    ) {
        return historyService.list(id, limit).stream()
                .map(com.watchlog.api.dto.WatchLogHistoryDto::from)
                .toList();
    }

}
