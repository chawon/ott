package com.watchlog.api.web;

import com.watchlog.api.dto.AuthPairRequest;
import com.watchlog.api.dto.AuthPairResponse;
import com.watchlog.api.dto.AuthRegisterResponse;
import com.watchlog.api.dto.DeviceDto;
import com.watchlog.api.dto.UpdateUserProfileRequest;
import com.watchlog.api.dto.UserProfileDto;
import com.watchlog.api.service.AccountDeletionService;
import com.watchlog.api.service.AuthService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final AccountDeletionService accountDeletionService;

    public AuthController(AuthService authService, AccountDeletionService accountDeletionService) {
        this.authService = authService;
        this.accountDeletionService = accountDeletionService;
    }

    @PostMapping("/register")
    public AuthRegisterResponse register(
            @RequestHeader(value = "User-Agent", required = false) String userAgent,
            @RequestHeader(value = "X-Client-Platform", required = false) String clientPlatform
    ) {
        return authService.register(userAgent, clientPlatform);
    }

    @PostMapping("/pair")
    public AuthPairResponse pair(
            @RequestBody AuthPairRequest req,
            @RequestHeader(value = "User-Agent", required = false) String userAgent,
            @RequestHeader(value = "X-Client-Platform", required = false) String clientPlatform
    ) {
        return authService.pair(req.code(), req.oldUserId(), userAgent, clientPlatform);
    }

    @GetMapping("/devices")
    public List<DeviceDto> devices(
            @RequestHeader(value = "X-User-Id", required = false) java.util.UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) java.util.UUID deviceId,
            @RequestHeader(value = "User-Agent", required = false) String userAgent,
            @RequestHeader(value = "X-Client-Platform", required = false) String clientPlatform
    ) {
        if (userId == null) return List.of();
        authService.requireActiveDevice(userId, deviceId);
        authService.touchDevice(userId, deviceId, userAgent, clientPlatform);
        return authService.listDevices(userId).stream().map(DeviceDto::from).toList();
    }

    @GetMapping("/profile")
    public UserProfileDto profile(
            @RequestHeader(value = "X-User-Id", required = false) java.util.UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) java.util.UUID deviceId
    ) {
        authService.requireActiveDevice(userId, deviceId);
        authService.touchDevice(userId, deviceId);
        return authService.getProfile(userId);
    }

    @PatchMapping("/profile")
    public UserProfileDto updateProfile(
            @RequestBody UpdateUserProfileRequest request,
            @RequestHeader(value = "X-User-Id", required = false) java.util.UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) java.util.UUID deviceId
    ) {
        authService.requireActiveDevice(userId, deviceId);
        authService.touchDevice(userId, deviceId);
        return authService.updateProfile(userId, request);
    }

    @DeleteMapping("/devices/{id}")
    public void revoke(
            @PathVariable java.util.UUID id,
            @RequestHeader(value = "X-User-Id", required = false) java.util.UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) java.util.UUID deviceId
    ) {
        if (userId == null) return;
        authService.requireActiveDevice(userId, deviceId);
        authService.revokeDevice(userId, id);
    }

    @DeleteMapping("/devices/all")
    public void revokeAll(
            @RequestHeader(value = "X-User-Id", required = false) java.util.UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) java.util.UUID deviceId
    ) {
        if (userId == null) return;
        authService.requireActiveDevice(userId, deviceId);
        authService.revokeAllDevices(userId);
    }

    @DeleteMapping("/account")
    public void deleteAccount(
            @RequestHeader(value = "X-User-Id", required = false) java.util.UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) java.util.UUID deviceId
    ) {
        if (userId == null) return;
        authService.requireActiveDevice(userId, deviceId);
        accountDeletionService.deleteAccount(userId);
    }
}
