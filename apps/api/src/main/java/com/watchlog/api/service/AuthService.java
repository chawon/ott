package com.watchlog.api.service;

import com.watchlog.api.domain.UserDeviceEntity;
import com.watchlog.api.domain.UserEntity;
import com.watchlog.api.dto.AuthPairResponse;
import com.watchlog.api.dto.AuthRegisterResponse;
import com.watchlog.api.repo.CommentRepository;
import com.watchlog.api.repo.UserDeviceRepository;
import com.watchlog.api.repo.UserRepository;
import com.watchlog.api.repo.WatchLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.UUID;

@Service
public class AuthService {

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;

    private final UserRepository userRepository;
    private final UserDeviceRepository userDeviceRepository;
    private final WatchLogRepository watchLogRepository;
    private final CommentRepository commentRepository;
    private final SecureRandom random = new SecureRandom();

    public AuthService(
            UserRepository userRepository,
            UserDeviceRepository userDeviceRepository,
            WatchLogRepository watchLogRepository,
            CommentRepository commentRepository
    ) {
        this.userRepository = userRepository;
        this.userDeviceRepository = userDeviceRepository;
        this.watchLogRepository = watchLogRepository;
        this.commentRepository = commentRepository;
    }

    @Transactional
    public AuthRegisterResponse register(String userAgent) {
        String code = generateCode();
        while (userRepository.findByPairingCode(code).isPresent()) {
            code = generateCode();
        }

        var user = new UserEntity(UUID.randomUUID(), code);
        userRepository.save(user);

        var device = new UserDeviceEntity(UUID.randomUUID(), user);
        applyAgentInfo(device, userAgent);
        userDeviceRepository.save(device);
        watchLogRepository.assignUserToOrphanLogs(user.getId());

        return new AuthRegisterResponse(user.getId(), device.getId(), code);
    }

    @Transactional
    public AuthPairResponse pair(String code, java.util.UUID oldUserId, String userAgent) {
        if (code == null || code.trim().isEmpty()) {
            throw new IllegalArgumentException("Pairing code is required");
        }
        var user = userRepository.findByPairingCode(code.trim())
                .orElseThrow(() -> new IllegalArgumentException("Invalid pairing code"));

        var device = new UserDeviceEntity(UUID.randomUUID(), user);
        applyAgentInfo(device, userAgent);
        userDeviceRepository.save(device);

        if (oldUserId != null && !oldUserId.equals(user.getId())) {
            mergeUsers(oldUserId, user.getId());
        }

        return new AuthPairResponse(user.getId(), device.getId(), user.getPairingCode());
    }

    @Transactional(readOnly = true)
    public java.util.List<com.watchlog.api.domain.UserDeviceEntity> listDevices(java.util.UUID userId) {
        return userDeviceRepository.findByUser_IdOrderByCreatedAtAsc(userId);
    }

    @Transactional
    public void revokeDevice(java.util.UUID userId, java.util.UUID deviceId) {
        var device = userDeviceRepository.findByIdAndUser_Id(deviceId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Device not found"));
        userDeviceRepository.delete(device);
    }

    @Transactional
    public void touchDevice(java.util.UUID userId, java.util.UUID deviceId) {
        if (userId == null || deviceId == null) return;
        userDeviceRepository.findByIdAndUser_Id(deviceId, userId).ifPresent(d -> {
            d.touch();
        });
    }

    private void mergeUsers(java.util.UUID fromUserId, java.util.UUID toUserId) {
        var fromLogs = watchLogRepository.findByUserId(fromUserId);
        for (var log : fromLogs) {
            var existing = watchLogRepository.findByTitle_IdAndUserIdAndDeletedAtIsNull(log.getTitle().getId(), toUserId);
            if (existing.isPresent()) {
                var target = existing.get();
                var sourceUpdated = log.getUpdatedAt() == null ? log.getCreatedAt() : log.getUpdatedAt();
                var targetUpdated = target.getUpdatedAt() == null ? target.getCreatedAt() : target.getUpdatedAt();
                if (sourceUpdated != null && targetUpdated != null && sourceUpdated.isAfter(targetUpdated)) {
                    target.setStatus(log.getStatus());
                    target.setRating(log.getRating());
                    target.setNote(log.getNote());
                    target.setSpoiler(log.isSpoiler());
                    target.setOtt(log.getOtt());
                    target.setWatchedAt(log.getWatchedAt());
                    target.setPlace(log.getPlace());
                    target.setOccasion(log.getOccasion());
                    target.setUpdatedAt(sourceUpdated);
                }
                watchLogRepository.delete(log);
            } else {
                log.setUserId(toUserId);
            }
        }

        commentRepository.assignUser(fromUserId, toUserId);
        userDeviceRepository.deleteByUser_Id(fromUserId);
        userRepository.deleteById(fromUserId);
    }

    private String generateCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            int idx = random.nextInt(CODE_ALPHABET.length());
            sb.append(CODE_ALPHABET.charAt(idx));
        }
        return sb.toString();
    }

    private void applyAgentInfo(UserDeviceEntity device, String userAgent) {
        if (userAgent == null || userAgent.isBlank()) return;
        device.setUserAgent(userAgent);
        device.setOs(parseOs(userAgent));
        device.setBrowser(parseBrowser(userAgent));
    }

    private String parseOs(String ua) {
        String v = ua.toLowerCase();
        if (v.contains("windows")) return "Windows";
        if (v.contains("mac os x") || v.contains("macintosh")) return "macOS";
        if (v.contains("android")) return "Android";
        if (v.contains("iphone") || v.contains("ipad")) return "iOS";
        if (v.contains("linux")) return "Linux";
        return "Unknown OS";
    }

    private String parseBrowser(String ua) {
        String v = ua.toLowerCase();
        if (v.contains("edg/")) return "Edge";
        if (v.contains("chrome/") && !v.contains("edg/") && !v.contains("opr/")) return "Chrome";
        if (v.contains("safari/") && !v.contains("chrome/")) return "Safari";
        if (v.contains("firefox/")) return "Firefox";
        if (v.contains("opr/") || v.contains("opera")) return "Opera";
        return "Unknown Browser";
    }
}
