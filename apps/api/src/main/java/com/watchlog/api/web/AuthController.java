package com.watchlog.api.web;

import com.watchlog.api.dto.AuthPairRequest;
import com.watchlog.api.dto.AuthPairResponse;
import com.watchlog.api.dto.AuthRegisterResponse;
import com.watchlog.api.dto.DeviceDto;
import com.watchlog.api.service.AuthService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public AuthRegisterResponse register(@RequestHeader(value = "User-Agent", required = false) String userAgent) {
        return authService.register(userAgent);
    }

    @PostMapping("/pair")
    public AuthPairResponse pair(
            @RequestBody AuthPairRequest req,
            @RequestHeader(value = "User-Agent", required = false) String userAgent
    ) {
        return authService.pair(req.code(), req.oldUserId(), userAgent);
    }

    @GetMapping("/devices")
    public List<DeviceDto> devices(
            @RequestHeader(value = "X-User-Id", required = false) java.util.UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) java.util.UUID deviceId
    ) {
        if (userId == null) return List.of();
        authService.touchDevice(userId, deviceId);
        return authService.listDevices(userId).stream().map(DeviceDto::from).toList();
    }

    @DeleteMapping("/devices/{id}")
    public void revoke(
            @PathVariable java.util.UUID id,
            @RequestHeader(value = "X-User-Id", required = false) java.util.UUID userId
    ) {
        if (userId == null) return;
        authService.revokeDevice(userId, id);
    }
}
