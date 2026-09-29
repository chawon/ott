package com.watchlog.api.web;

import com.watchlog.api.dto.NetflixImportRequest;
import com.watchlog.api.dto.NetflixImportResult;
import com.watchlog.api.dto.NetflixViewingEventDto;
import com.watchlog.api.service.AuthService;
import com.watchlog.api.service.NetflixImportService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/imports/netflix")
public class NetflixImportController {
    private final AuthService authService;
    private final NetflixImportService importService;

    public NetflixImportController(AuthService authService, NetflixImportService importService) {
        this.authService = authService;
        this.importService = importService;
    }

    @GetMapping
    public List<NetflixViewingEventDto> list(
            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) UUID deviceId
    ) {
        authService.requireActiveDevice(userId, deviceId);
        return importService.list(userId);
    }

    @PostMapping
    public NetflixImportResult importRows(
            @RequestBody NetflixImportRequest request,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) UUID deviceId
    ) {
        authService.requireActiveDevice(userId, deviceId);
        return importService.importRows(userId, request);
    }
}
