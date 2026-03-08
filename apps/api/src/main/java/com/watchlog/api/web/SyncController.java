package com.watchlog.api.web;

import com.watchlog.api.dto.SyncPullResponse;
import com.watchlog.api.dto.SyncPushRequest;
import com.watchlog.api.dto.SyncPushResponse;
import com.watchlog.api.service.AuthService;
import com.watchlog.api.service.SyncService;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/api/sync")
public class SyncController {

    private final SyncService syncService;
    private final AuthService authService;

    public SyncController(SyncService syncService, AuthService authService) {
        this.syncService = syncService;
        this.authService = authService;
    }

    @PostMapping("/push")
    public SyncPushResponse push(
            @RequestBody SyncPushRequest request,
            @RequestHeader(value = "X-User-Id", required = false) java.util.UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) java.util.UUID deviceId,
            @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String language
    ) {
        authService.requireActiveDevice(userId, deviceId);
        var normalizedRequest = new SyncPushRequest(
                userId,
                deviceId == null ? null : deviceId.toString(),
                request.clientTime(),
                request.changes()
        );
        return syncService.push(normalizedRequest, language);
    }

    @GetMapping("/pull")
    public SyncPullResponse pull(
            @RequestParam(value = "since", required = false) OffsetDateTime since,
            @RequestHeader(value = "X-User-Id", required = false) java.util.UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) java.util.UUID deviceId
    ) {
        authService.requireActiveDevice(userId, deviceId);
        return syncService.pull(since, userId);
    }
}
