package com.watchlog.api.web;

import com.watchlog.api.dto.DiscussionConnectionDto;
import com.watchlog.api.service.AuthService;
import com.watchlog.api.service.DiscussionConnectionService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class DiscussionConnectionController {
    private final AuthService authService;
    private final DiscussionConnectionService connectionService;

    public DiscussionConnectionController(AuthService authService, DiscussionConnectionService connectionService) {
        this.authService = authService;
        this.connectionService = connectionService;
    }

    @GetMapping("/api/discussions/connection")
    public ResponseEntity<DiscussionConnectionDto> get(
            @RequestParam("titleId") UUID titleId,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) UUID deviceId
    ) {
        authService.requireActiveDevice(userId, deviceId);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore().cachePrivate())
                .body(connectionService.find(titleId, userId));
    }
}
