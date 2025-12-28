package com.watchlog.api.web;

import com.watchlog.api.dto.SyncPullResponse;
import com.watchlog.api.dto.SyncPushRequest;
import com.watchlog.api.dto.SyncPushResponse;
import com.watchlog.api.service.SyncService;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/api/sync")
public class SyncController {

    private final SyncService syncService;

    public SyncController(SyncService syncService) {
        this.syncService = syncService;
    }

    @PostMapping("/push")
    public SyncPushResponse push(@RequestBody SyncPushRequest request) {
        return syncService.push(request);
    }

    @GetMapping("/pull")
    public SyncPullResponse pull(
            @RequestParam(value = "since", required = false) OffsetDateTime since,
            @RequestHeader(value = "X-User-Id", required = false) java.util.UUID userId
    ) {
        return syncService.pull(since, userId);
    }
}
