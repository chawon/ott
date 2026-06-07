package com.watchlog.api.web;

import com.watchlog.api.dto.AndroidNotificationDeviceBindRequest;
import com.watchlog.api.dto.AndroidNotificationDeviceBindResponse;
import com.watchlog.api.dto.AndroidNotificationPreferenceRequest;
import com.watchlog.api.dto.AndroidReminderAckRequest;
import com.watchlog.api.dto.AndroidReminderNextRequest;
import com.watchlog.api.dto.AndroidReminderNextResponse;
import com.watchlog.api.service.AndroidReminderService;
import com.watchlog.api.service.AuthService;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/android")
public class AndroidNotificationController {

    private final AndroidReminderService androidReminderService;
    private final AuthService authService;

    public AndroidNotificationController(
            AndroidReminderService androidReminderService,
            AuthService authService
    ) {
        this.androidReminderService = androidReminderService;
        this.authService = authService;
    }

    @PostMapping("/notification-devices/bind")
    public AndroidNotificationDeviceBindResponse bindDevice(
            @RequestBody AndroidNotificationDeviceBindRequest request,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
            @RequestHeader(value = "X-Device-Id", required = false) UUID deviceId
    ) {
        authService.requireActiveDevice(userId, deviceId);
        authService.touchDevice(userId, deviceId);
        return androidReminderService.bindDevice(userId, deviceId, request);
    }

    @PatchMapping("/notification-devices/preferences")
    public void updatePreferences(@RequestBody AndroidNotificationPreferenceRequest request) {
        androidReminderService.updatePreferences(request);
    }

    @PostMapping("/reminders/next")
    public AndroidReminderNextResponse nextReminder(@RequestBody AndroidReminderNextRequest request) {
        return androidReminderService.nextReminder(request);
    }

    @PostMapping("/reminders/{deliveryId}/delivered")
    public void markDelivered(
            @PathVariable UUID deliveryId,
            @RequestBody AndroidReminderAckRequest request
    ) {
        androidReminderService.markDelivered(deliveryId, request.installToken());
    }

    @PostMapping("/reminders/{deliveryId}/opened")
    public void markOpened(
            @PathVariable UUID deliveryId,
            @RequestBody AndroidReminderAckRequest request
    ) {
        androidReminderService.markOpened(deliveryId, request.installToken());
    }
}
