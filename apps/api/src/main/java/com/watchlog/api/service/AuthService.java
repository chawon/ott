package com.watchlog.api.service;

import com.watchlog.api.domain.UserDeviceEntity;
import com.watchlog.api.domain.UserEntity;
import com.watchlog.api.dto.AuthPairResponse;
import com.watchlog.api.dto.AuthRegisterResponse;
import com.watchlog.api.dto.UpdateUserProfileRequest;
import com.watchlog.api.dto.UserProfileDto;
import com.watchlog.api.repo.CommentRepository;
import com.watchlog.api.repo.DiscussionReactionRepository;
import com.watchlog.api.repo.UserDeviceRepository;
import com.watchlog.api.repo.UserRepository;
import com.watchlog.api.repo.WatchLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class AuthService {

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;
    private static final int MAX_NICKNAME_LENGTH = 32;
    private static final Pattern IPAD = Pattern.compile("\\bipad(?:os)?\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern IPHONE = Pattern.compile("\\biphone\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern TABLET = Pattern.compile("\\btablet\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern MOBILE = Pattern.compile("\\bmobile\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern ANDROID_VERSION = Pattern.compile("\\bandroid\\s+[0-9]", Pattern.CASE_INSENSITIVE);
    private static final Pattern ANDROID_TV = Pattern.compile("\\b(?:android[ -]?tv|tv|bravia|aft\\w*)\\b", Pattern.CASE_INSENSITIVE);
    private static final Set<String> PERSONA_KEYS = Set.of(
            "cinema_keeper",
            "book_drifter",
            "deep_watcher",
            "midnight_logger",
            "weekend_curator",
            "archive_collector"
    );

    private final UserRepository userRepository;
    private final UserDeviceRepository userDeviceRepository;
    private final WatchLogRepository watchLogRepository;
    private final CommentRepository commentRepository;
    private final DiscussionReactionRepository discussionReactionRepository;
    private final AndroidReminderService androidReminderService;
    private final RecommendationAccountStore recommendationAccounts;
    private final AccountWriteLock writeLock;
    private final SecureRandom random = new SecureRandom();

    public AuthService(
            UserRepository userRepository,
            UserDeviceRepository userDeviceRepository,
            WatchLogRepository watchLogRepository,
            CommentRepository commentRepository,
            DiscussionReactionRepository discussionReactionRepository,
            AndroidReminderService androidReminderService,
            RecommendationAccountStore recommendationAccounts,
            AccountWriteLock writeLock
    ) {
        this.userRepository = userRepository;
        this.userDeviceRepository = userDeviceRepository;
        this.watchLogRepository = watchLogRepository;
        this.commentRepository = commentRepository;
        this.discussionReactionRepository = discussionReactionRepository;
        this.androidReminderService = androidReminderService;
        this.recommendationAccounts = recommendationAccounts;
        this.writeLock = writeLock;
    }

    @Transactional
    public AuthRegisterResponse register(String userAgent) {
        return register(userAgent, null);
    }

    @Transactional
    public AuthRegisterResponse register(String userAgent, String clientPlatform) {
        String code = generateCode();
        while (userRepository.findByPairingCode(code).isPresent()) {
            code = generateCode();
        }

        var user = new UserEntity(UUID.randomUUID(), code);
        userRepository.save(user);

        var device = new UserDeviceEntity(UUID.randomUUID(), user);
        applyAgentInfo(device, userAgent, clientPlatform);
        userDeviceRepository.save(device);
        watchLogRepository.assignUserToOrphanLogs(user.getId());

        return new AuthRegisterResponse(user.getId(), device.getId(), code);
    }

    @Transactional
    public AuthPairResponse pair(String code, java.util.UUID oldUserId, String userAgent) {
        return pair(code, oldUserId, userAgent, null);
    }

    @Transactional
    public AuthPairResponse pair(String code, java.util.UUID oldUserId, String userAgent, String clientPlatform) {
        if (code == null || code.trim().isEmpty()) {
            throw new IllegalArgumentException("Pairing code is required");
        }
        var user = userRepository.findByPairingCode(code.trim())
                .orElseThrow(() -> new IllegalArgumentException("Invalid pairing code"));

        var device = new UserDeviceEntity(UUID.randomUUID(), user);
        applyAgentInfo(device, userAgent, clientPlatform);
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
        androidReminderService.revokeByDevice(userId, deviceId);
        userDeviceRepository.delete(device);
    }

    @Transactional
    public void revokeAllDevices(java.util.UUID userId) {
        if (userId == null) return;
        androidReminderService.revokeByUser(userId);
        userDeviceRepository.deleteByUser_Id(userId);
    }

    @Transactional
    public void touchDevice(java.util.UUID userId, java.util.UUID deviceId) {
        touchDevice(userId, deviceId, null, null);
    }

    @Transactional
    public void touchDevice(java.util.UUID userId, java.util.UUID deviceId, String userAgent, String clientPlatform) {
        if (userId == null || deviceId == null) return;
        userDeviceRepository.findByIdAndUser_Id(deviceId, userId).ifPresent(d -> {
            d.touch();
            applyAgentInfo(d, userAgent, clientPlatform);
        });
    }

    @Transactional(readOnly = true)
    public void requireActiveDevice(java.util.UUID userId, java.util.UUID deviceId) {
        if (userId == null || deviceId == null) {
            throw new ResponseStatusException(UNAUTHORIZED, "Active device is required");
        }
        if (!userDeviceRepository.existsByIdAndUser_Id(deviceId, userId)) {
            throw new ResponseStatusException(UNAUTHORIZED, "Device has been unlinked");
        }
    }

    @Transactional(readOnly = true)
    public UserProfileDto getProfile(java.util.UUID userId) {
        var user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return UserProfileDto.from(user);
    }

    @Transactional
    public UserProfileDto updateProfile(java.util.UUID userId, UpdateUserProfileRequest request) {
        var nickname = normalizeNickname(request == null ? null : request.nickname());
        var personaKey = normalizePersonaKey(request == null ? null : request.personaKey());
        var user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.updateProfile(nickname, personaKey);
        return UserProfileDto.from(user);
    }

    private void mergeUsers(java.util.UUID fromUserId, java.util.UUID toUserId) {
        writeLock.acquire(fromUserId, toUserId);
        recommendationAccounts.merge(fromUserId, toUserId);
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
        discussionReactionRepository.deleteDuplicatesForMerge(fromUserId, toUserId);
        discussionReactionRepository.assignUser(fromUserId, toUserId);
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

    private void applyAgentInfo(UserDeviceEntity device, String userAgent, String clientPlatform) {
        String nativeOs = nativeClientOs(device, clientPlatform, userAgent);
        if (nativeOs != null) {
            String nativeBrowser = switch (nativeOs) {
                case "iPadOS" -> "iPad App";
                case "Android" -> isAndroidTablet(device, userAgent) ? "Android Tablet App" : "Android App";
                default -> nativeOs + " App";
            };
            if ((userAgent == null || userAgent.isBlank())
                    && nativeOs.equals(device.getOs()) && nativeBrowser.equals(device.getBrowser())) return;
            device.setUserAgent(normalizeMetadata(userAgent, clientPlatform));
            device.setOs(nativeOs);
            device.setBrowser(nativeBrowser);
            return;
        }
        if (userAgent == null || userAgent.isBlank()) return;
        device.setUserAgent(userAgent);
        device.setOs(parseOs(userAgent));
        device.setBrowser(parseBrowser(userAgent));
    }

    private String nativeClientOs(UserDeviceEntity device, String clientPlatform, String userAgent) {
        String ua = userAgent == null ? "" : userAgent;
        if (clientPlatform != null && !clientPlatform.isBlank()) {
            return switch (clientPlatform.trim().toLowerCase(Locale.ROOT)) {
                case "ios_native" -> {
                    boolean knownIpad = "iPadOS".equals(device.getOs()) && "iPad App".equals(device.getBrowser());
                    yield IPAD.matcher(ua).find() || (knownIpad && !IPHONE.matcher(ua).find()) ? "iPadOS" : "iOS";
                }
                case "android_native" -> "Android";
                case "windows_native" -> "Windows";
                case "macos_native" -> "macOS";
                default -> null;
            };
        }
        if (userAgent != null && userAgent.toLowerCase(Locale.ROOT).contains("ottline-android/")) {
            return "Android";
        }
        return null;
    }

    private boolean isAndroidTablet(UserDeviceEntity device, String userAgent) {
        String ua = userAgent == null ? "" : userAgent;
        if (TABLET.matcher(ua).find()) return true;
        if (ANDROID_TV.matcher(ua).find() || MOBILE.matcher(ua).find()) return false;
        String lower = ua.toLowerCase(Locale.ROOT);
        if (lower.startsWith("mozilla/") && (lower.contains("applewebkit/") || lower.contains("chrome/") || lower.contains("safari/"))
                && ANDROID_VERSION.matcher(ua).find()) return true;
        // Generic/absent metadata is not evidence that a previously identified tablet became a phone.
        return "Android".equals(device.getOs()) && "Android Tablet App".equals(device.getBrowser());
    }

    private String normalizeMetadata(String userAgent, String fallback) {
        if (userAgent != null && !userAgent.isBlank()) return userAgent;
        return fallback;
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

    private String normalizeNickname(String nickname) {
        if (nickname == null) {
            throw new IllegalArgumentException("Nickname is required");
        }
        var normalized = nickname.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Nickname is required");
        }
        if (normalized.length() > MAX_NICKNAME_LENGTH) {
            throw new IllegalArgumentException("Nickname must be 32 characters or fewer");
        }
        return normalized;
    }

    private String normalizePersonaKey(String personaKey) {
        if (personaKey == null) {
            throw new IllegalArgumentException("Persona is required");
        }
        var normalized = personaKey.trim().toLowerCase(Locale.ROOT);
        if (!PERSONA_KEYS.contains(normalized)) {
            throw new IllegalArgumentException("Invalid persona");
        }
        return normalized;
    }
}
