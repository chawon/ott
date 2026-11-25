package com.watchlog.api.service;

import com.watchlog.api.domain.UserDeviceEntity;
import com.watchlog.api.domain.UserEntity;
import com.watchlog.api.dto.DeviceDto;
import com.watchlog.api.dto.UpdateUserProfileRequest;
import com.watchlog.api.repo.CommentRepository;
import com.watchlog.api.repo.DiscussionReactionRepository;
import com.watchlog.api.repo.UserDeviceRepository;
import com.watchlog.api.repo.UserRepository;
import com.watchlog.api.repo.WatchLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuthServiceProfileTest {

    private UserRepository userRepository;
    private UserDeviceRepository userDeviceRepository;
    private AuthService authService;
    private Map<UUID, UserEntity> users;
    private Map<UUID, UserDeviceEntity> devices;
    private UserDeviceEntity lastSavedDevice;

    @BeforeEach
    void setUp() {
        users = new HashMap<>();
        devices = new HashMap<>();
        lastSavedDevice = null;
        userRepository = repositoryProxy(UserRepository.class, this::handleUserRepository);
        userDeviceRepository = repositoryProxy(UserDeviceRepository.class, this::handleUserDeviceRepository);
        authService = new AuthService(
                userRepository,
                userDeviceRepository,
                repositoryProxy(WatchLogRepository.class, this::defaultRepositoryReturn),
                repositoryProxy(CommentRepository.class, this::defaultRepositoryReturn),
                repositoryProxy(DiscussionReactionRepository.class, this::defaultRepositoryReturn),
                null,
                org.mockito.Mockito.mock(RecommendationAccountStore.class),
                org.mockito.Mockito.mock(AccountWriteLock.class)
        );
    }

    @Test
    void updateProfileTrimsNicknameAndStoresPersonaKey() {
        var user = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
        users.put(user.getId(), user);

        var profile = authService.updateProfile(
                user.getId(),
                new UpdateUserProfileRequest("  타임라인러  ", "Cinema_Keeper")
        );

        assertThat(profile.nickname()).isEqualTo("타임라인러");
        assertThat(profile.personaKey()).isEqualTo("cinema_keeper");
        assertThat(profile.profileUpdatedAt()).isNotNull();
        assertThat(user.getNickname()).isEqualTo("타임라인러");
        assertThat(user.getPersonaKey()).isEqualTo("cinema_keeper");
    }

    @Test
    void updateProfileRejectsBlankOrLongNickname() {
        var user = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
        users.put(user.getId(), user);

        assertThatThrownBy(() -> authService.updateProfile(
                user.getId(),
                new UpdateUserProfileRequest(" ", "cinema_keeper")
        )).isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> authService.updateProfile(
                user.getId(),
                new UpdateUserProfileRequest("a".repeat(33), "cinema_keeper")
        )).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateProfileRejectsUnknownPersonaKey() {
        var user = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
        users.put(user.getId(), user);

        assertThatThrownBy(() -> authService.updateProfile(
                user.getId(),
                new UpdateUserProfileRequest("타임라인러", "unknown")
        )).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void requireActiveDeviceRejectsMissingHeaders() {
        assertThatThrownBy(() -> authService.requireActiveDevice(null, UUID.randomUUID()))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED)
                );
    }

    @Test
    void registerStoresIosNativeDeviceInfoFromClientPlatform() {
        authService.register(null, "ios_native");

        assertThat(lastSavedDevice).isNotNull();
        assertThat(lastSavedDevice.getUserAgent()).isEqualTo("ios_native");
        assertThat(lastSavedDevice.getOs()).isEqualTo("iOS");
        assertThat(lastSavedDevice.getBrowser()).isEqualTo("iOS App");
    }

    @Test
    void touchDeviceRefreshesIosNativeDeviceInfo() {
        var user = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
        var device = new UserDeviceEntity(UUID.randomUUID(), user);
        device.setOs("Unknown OS");
        device.setBrowser("Unknown Browser");
        devices.put(device.getId(), device);

        authService.touchDevice(user.getId(), device.getId(), null, "ios_native");

        assertThat(device.getUserAgent()).isEqualTo("ios_native");
        assertThat(device.getOs()).isEqualTo("iOS");
        assertThat(device.getBrowser()).isEqualTo("iOS App");
    }

    static Stream<Arguments> desktopNativeClients() {
        return Stream.of(
                Arguments.of("windows_native", "Windows", "OttlineWindowsNative/2.0.0.0"),
                Arguments.of("macos_native", "macOS", "ottline-mac/2.0.0 (Macintosh; Mac OS X)"),
                Arguments.of(" Windows_NATIVE ", "Windows", "OttlineWindowsNative/2.0.0.0"),
                Arguments.of(" MacOS_NATIVE ", "macOS", "ottline-mac/2.0.0 (Macintosh; Mac OS X)")
        );
    }

    @ParameterizedTest
    @MethodSource("desktopNativeClients")
    void registerStoresDesktopNativeDeviceInfo(String platform, String os, String userAgent) {
        var registration = authService.register(userAgent, platform);

        assertThat(lastSavedDevice.getId()).isEqualTo(registration.deviceId());
        assertThat(lastSavedDevice.getUserAgent()).isEqualTo(userAgent);
        assertThat(lastSavedDevice.getOs()).isEqualTo(os);
        assertThat(DeviceDto.from(lastSavedDevice).browser()).isEqualTo(os + " App");
    }

    @ParameterizedTest
    @MethodSource("desktopNativeClients")
    void pairStoresDesktopNativeDeviceInfo(String platform, String os, String userAgent) {
        var user = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
        users.put(user.getId(), user);

        var pairing = authService.pair("ABCDEFGH", null, userAgent, platform);

        assertThat(pairing.userId()).isEqualTo(user.getId());
        assertThat(lastSavedDevice.getId()).isEqualTo(pairing.deviceId());
        assertThat(lastSavedDevice.getUser()).isSameAs(user);
        assertThat(lastSavedDevice.getUserAgent()).isEqualTo(userAgent);
        assertThat(lastSavedDevice.getOs()).isEqualTo(os);
        assertThat(lastSavedDevice.getBrowser()).isEqualTo(os + " App");
    }

    @ParameterizedTest
    @MethodSource("desktopNativeClients")
    void touchDeviceCorrectsLegacyDesktopInfoWithoutRelinking(String platform, String os, String userAgent) {
        var user = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
        var device = new UserDeviceEntity(UUID.randomUUID(), user);
        device.setOs(os.equals("macOS") ? "iOS" : "Windows");
        device.setBrowser(os.equals("macOS") ? "iOS App" : "Unknown Browser");
        devices.put(device.getId(), device);
        var createdAt = device.getCreatedAt();
        var previousLastSeenAt = device.getLastSeenAt();

        authService.touchDevice(user.getId(), device.getId(), userAgent, platform);
        // Normal authenticated operations without metadata must retain the correction.
        authService.touchDevice(user.getId(), device.getId());
        var listed = authService.listDevices(user.getId()).stream().map(DeviceDto::from).toList();

        assertThat(devices).hasSize(1);
        assertThat(listed).hasSize(1);
        assertThat(listed.getFirst().id()).isEqualTo(device.getId());
        assertThat(listed.getFirst().createdAt()).isEqualTo(createdAt);
        assertThat(listed.getFirst().lastSeenAt()).isAfterOrEqualTo(previousLastSeenAt);
        assertThat(listed.getFirst().os()).isEqualTo(os);
        assertThat(listed.getFirst().browser()).isEqualTo(os + " App");
        assertThat(device.getUser()).isSameAs(user);
        assertThat(device.getUserAgent()).isEqualTo(userAgent);
    }

    @ParameterizedTest
    @CsvSource({"windows_native,Windows", "macos_native,macOS"})
    void desktopPlatformDoesNotRequireUserAgent(String platform, String os) {
        for (String userAgent : new String[] {null, "", " "}) {
            authService.register(userAgent, platform);

            assertThat(lastSavedDevice.getUserAgent()).isEqualTo(platform);
            assertThat(lastSavedDevice.getOs()).isEqualTo(os);
            assertThat(lastSavedDevice.getBrowser()).isEqualTo(os + " App");
        }
    }

    @Test
    void unknownOrMissingPlatformKeepsWebBrowserClassification() {
        for (String platform : new String[] {null, "", "web", "windows_native_extra", "macos_native_extra"}) {
            authService.register("Mozilla/5.0 (Windows NT 10.0) Chrome/143.0 Safari/537.36", platform);
            assertThat(lastSavedDevice.getOs()).isEqualTo("Windows");
            assertThat(lastSavedDevice.getBrowser()).isEqualTo("Chrome");

            authService.register("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.2 Safari/605.1.15", platform);
            assertThat(lastSavedDevice.getOs()).isEqualTo("macOS");
            assertThat(lastSavedDevice.getBrowser()).isEqualTo("Safari");
        }
    }

    @Test
    void desktopMetadataCannotTouchAnotherAccountsDeviceOrCreateMissingDevice() {
        var owner = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
        var device = new UserDeviceEntity(UUID.randomUUID(), owner);
        device.setOs("Windows");
        device.setBrowser("Chrome");
        devices.put(device.getId(), device);
        var lastSeenAt = device.getLastSeenAt();

        authService.touchDevice(UUID.randomUUID(), device.getId(), "ottline-mac/2.0", "macos_native");
        authService.touchDevice(owner.getId(), UUID.randomUUID(), "OttlineWindowsNative/2.0", "windows_native");

        assertThat(devices).hasSize(1);
        assertThat(device.getOs()).isEqualTo("Windows");
        assertThat(device.getBrowser()).isEqualTo("Chrome");
        assertThat(device.getLastSeenAt()).isEqualTo(lastSeenAt);
    }

    @ParameterizedTest
    @CsvSource({
            "android_native, Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/134.0.0.0 Mobile Safari/537.36 ottline-android/2.0.5",
            " Android_NATIVE , Mozilla/5.0 (Linux; Android 15; SM-S928N) Chrome/134.0.0.0 Mobile Safari/537.36 ottline-android/2.0.5"
    })
    void registerAndPairStoreAndroidNativeFromHeader(String platform, String userAgent) {
        var registered = authService.register(userAgent, platform);
        assertThat(lastSavedDevice.getId()).isEqualTo(registered.deviceId());
        assertThat(lastSavedDevice.getOs()).isEqualTo("Android");
        assertThat(DeviceDto.from(lastSavedDevice).browser()).isEqualTo("Android App");

        var user = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
        users.put(user.getId(), user);
        var paired = authService.pair("ABCDEFGH", null, userAgent, platform);
        assertThat(paired.userId()).isEqualTo(user.getId());
        assertThat(lastSavedDevice.getOs()).isEqualTo("Android");
        assertThat(lastSavedDevice.getBrowser()).isEqualTo("Android App");
    }

    @Test
    void androidNativePlatformDoesNotRequireUserAgent() {
        for (String userAgent : new String[] {null, "", " "}) {
            authService.register(userAgent, "android_native");

            assertThat(lastSavedDevice.getUserAgent()).isEqualTo("android_native");
            assertThat(lastSavedDevice.getOs()).isEqualTo("Android");
            assertThat(lastSavedDevice.getBrowser()).isEqualTo("Android App");
        }
    }

    @Test
    void legacyAndroidNative204WithoutPlatformHeaderUsesOttlineAndroidUserAgent() {
        String ua204 = "Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/134.0.0.0 Mobile Safari/537.36 ottline-android/2.0.4";

        for (String platform : new String[] {null, "", " "}) {
            authService.register(ua204, platform);
            assertThat(lastSavedDevice.getOs()).isEqualTo("Android");
            assertThat(lastSavedDevice.getBrowser()).isEqualTo("Android App");
        }

        var user = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
        users.put(user.getId(), user);
        var paired = authService.pair("ABCDEFGH", null, ua204, null);
        assertThat(lastSavedDevice.getId()).isEqualTo(paired.deviceId());
        assertThat(lastSavedDevice.getOs()).isEqualTo("Android");
        assertThat(lastSavedDevice.getBrowser()).isEqualTo("Android App");

        // Existing TWA handoff device transitioning onto v2.0.4 native app updates in place
        var twaDevice = new UserDeviceEntity(UUID.randomUUID(), user);
        twaDevice.setOs("Android");
        twaDevice.setBrowser("Chrome");
        devices.put(twaDevice.getId(), twaDevice);
        var createdAt = twaDevice.getCreatedAt();

        authService.touchDevice(user.getId(), twaDevice.getId(), ua204, null);
        authService.touchDevice(user.getId(), twaDevice.getId());

        assertThat(twaDevice.getId()).isEqualTo(twaDevice.getId());
        assertThat(twaDevice.getCreatedAt()).isEqualTo(createdAt);
        assertThat(twaDevice.getOs()).isEqualTo("Android");
        assertThat(twaDevice.getBrowser()).isEqualTo("Android App");
        assertThat(twaDevice.getUserAgent()).isEqualTo(ua204);
    }

    @Test
    void androidChromePwaRemainsChromeAcrossWebAndMissingPlatform() {
        String chromeUa = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36";
        for (String platform : new String[] {null, "", "web", "android_native_extra"}) {
            authService.register(chromeUa, platform);
            assertThat(lastSavedDevice.getOs()).isEqualTo("Android");
            assertThat(lastSavedDevice.getBrowser()).isEqualTo("Chrome");
        }
    }

    static Stream<Arguments> nativeMobileDevices() {
        return Stream.of(
                Arguments.of("ios_native", "ottline-ios/2.0.0 (iPhone; iOS)", "iOS", "iOS App"),
                Arguments.of("ios_native", "ottline-ios/2.0.0 (iPad; iPadOS)", "iPadOS", "iPad App"),
                Arguments.of(" IOS_NATIVE ", "ottline-ios/2.0.0 (IPADOS 17.0)", "iPadOS", "iPad App"),
                Arguments.of("android_native", "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/134.0 Mobile Safari/537.36 ottline-android/2.0.5", "Android", "Android App"),
                Arguments.of("android_native", "Mozilla/5.0 (Linux; Android 15; SM-X810; Tablet) Chrome/134.0.0.0 Safari/537.36 ottline-android/2.0.5", "Android", "Android Tablet App"),
                Arguments.of("ANDROID_NATIVE", "Mozilla/5.0 (Linux; Android 15; SM-X810) Chrome/134.0.0.0 Safari/537.36 ottline-android/2.0.5", "Android", "Android Tablet App"),
                Arguments.of(null, "Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 Chrome/134.0 Safari/537.36 ottline-android/2.0.5", "Android", "Android Tablet App"),
                Arguments.of("android_native", "ottline-android/2.0.4", "Android", "Android App"),
                Arguments.of("android_native", "okhttp/4.12.0", "Android", "Android App"),
                Arguments.of("android_native", "Dalvik/2.1.0 (Linux; U; Android 15)", "Android", "Android App"),
                Arguments.of("android_native", "Mozilla/5.0 (Linux; Android 12; Android TV) AppleWebKit/537.36 Chrome/134.0 Safari/537.36", "Android", "Android App"),
                Arguments.of("android_native", "ottline-android/2.0.5 (notatablet)", "Android", "Android App"),
                Arguments.of("ios_native", "ottline-ios/2.0.0 (notipad)", "iOS", "iOS App"),
                Arguments.of("android_native", "ottline-android/2.0.5 (Tablet; Mobile)", "Android", "Android Tablet App")
        );
    }

    @ParameterizedTest
    @MethodSource("nativeMobileDevices")
    void nativeMobileDevicesAreIdentifiedOnRegistrationAndPairing(String platform, String ua, String os, String browser) {
        authService.register(ua, platform);
        assertThat(lastSavedDevice.getOs()).isEqualTo(os);
        assertThat(DeviceDto.from(lastSavedDevice).browser()).isEqualTo(browser);

        var user = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
        users.put(user.getId(), user);
        authService.pair("ABCDEFGH", null, ua, platform);
        assertThat(lastSavedDevice.getOs()).isEqualTo(os);
        assertThat(DeviceDto.from(lastSavedDevice).browser()).isEqualTo(browser);
    }

    @ParameterizedTest
    @MethodSource("nativeMobileDevices")
    void nativeMobileMetadataRefreshesTheExistingDeviceWithoutRelinking(String platform, String ua, String os, String browser) {
        var user = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
        var device = new UserDeviceEntity(UUID.randomUUID(), user);
        device.setOs("Unknown OS");
        device.setBrowser("Unknown Browser");
        devices.put(device.getId(), device);
        var createdAt = device.getCreatedAt();

        authService.touchDevice(user.getId(), device.getId(), ua, platform);
        authService.touchDevice(user.getId(), device.getId());
        var response = authService.listDevices(user.getId()).stream().map(DeviceDto::from).toList();

        assertThat(response).hasSize(1);
        assertThat(response.getFirst().id()).isEqualTo(device.getId());
        assertThat(response.getFirst().createdAt()).isEqualTo(createdAt);
        assertThat(response.getFirst().os()).isEqualTo(os);
        assertThat(response.getFirst().browser()).isEqualTo(browser);
        assertThat(device.getUser()).isSameAs(user);
    }

    @Test
    void missingOrGenericUserAgentDoesNotEraseKnownTabletMetadata() {
        for (String platform : new String[]{"ios_native", "android_native"}) {
            String os = platform.equals("ios_native") ? "iPadOS" : "Android";
            String browser = platform.equals("ios_native") ? "iPad App" : "Android Tablet App";
            var user = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
            var device = new UserDeviceEntity(UUID.randomUUID(), user);
            device.setOs(os);
            device.setBrowser(browser);
            device.setUserAgent("known tablet metadata");
            devices.put(device.getId(), device);

            for (String ua : new String[]{null, "", " ", "okhttp/4.12.0", "ottline-android/2.0.5"}) {
                authService.touchDevice(user.getId(), device.getId(), ua, platform);
                assertThat(device.getOs()).isEqualTo(os);
                assertThat(device.getBrowser()).isEqualTo(browser);
            }
        }
    }

    @Test
    void tabletBrowserWithoutNativePlatformRemainsAWebBrowser() {
        for (String platform : new String[]{null, "", "web", "android_native_extra"}) {
            authService.register("Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 Chrome/134.0 Safari/537.36", platform);
            assertThat(lastSavedDevice.getOs()).isEqualTo("Android");
            assertThat(lastSavedDevice.getBrowser()).isEqualTo("Chrome");
        }
    }

    @Test
    void explicitPhoneMetadataCanCorrectAnEarlierTabletLabel() {
        for (String platform : new String[]{"ios_native", "android_native"}) {
            boolean ios = platform.equals("ios_native");
            var user = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
            var device = new UserDeviceEntity(UUID.randomUUID(), user);
            device.setOs(ios ? "iPadOS" : "Android");
            device.setBrowser(ios ? "iPad App" : "Android Tablet App");
            devices.put(device.getId(), device);
            String ua = ios ? "ottline-ios/2.0.0 (iPhone; iOS)"
                    : "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/134.0 Mobile Safari/537.36";

            authService.touchDevice(user.getId(), device.getId(), ua, platform);
            authService.touchDevice(user.getId(), device.getId(), null, platform);

            assertThat(device.getOs()).isEqualTo(ios ? "iOS" : "Android");
            assertThat(device.getBrowser()).isEqualTo(ios ? "iOS App" : "Android App");
            assertThat(device.getUserAgent()).isEqualTo(ua);
        }
    }

    private Object handleUserRepository(Object proxy, Method method, Object[] args) {
        return switch (method.getName()) {
            case "findById" -> Optional.ofNullable(users.get((UUID) args[0]));
            case "findByPairingCode" -> users.values().stream()
                    .filter(user -> user.getPairingCode().equals(args[0]))
                    .findFirst();
            case "save" -> {
                var user = (UserEntity) args[0];
                users.put(user.getId(), user);
                yield user;
            }
            case "deleteById" -> {
                users.remove((UUID) args[0]);
                yield null;
            }
            default -> defaultRepositoryReturn(proxy, method, args);
        };
    }

    private Object handleUserDeviceRepository(Object proxy, Method method, Object[] args) {
        return switch (method.getName()) {
            case "save" -> {
                lastSavedDevice = (UserDeviceEntity) args[0];
                devices.put(lastSavedDevice.getId(), lastSavedDevice);
                yield lastSavedDevice;
            }
            case "findByIdAndUser_Id" -> {
                var device = devices.get((UUID) args[0]);
                yield device != null && device.getUser().getId().equals(args[1])
                        ? Optional.of(device)
                        : Optional.empty();
            }
            case "existsByIdAndUser_Id" -> {
                var device = devices.get((UUID) args[0]);
                yield device != null && device.getUser().getId().equals(args[1]);
            }
            case "findByUser_IdOrderByCreatedAtAsc" -> devices.values().stream()
                    .filter(device -> device.getUser().getId().equals(args[0]))
                    .toList();
            case "delete" -> {
                devices.remove(((UserDeviceEntity) args[0]).getId());
                yield null;
            }
            case "deleteByUser_Id" -> {
                devices.values().removeIf(device -> device.getUser().getId().equals(args[0]));
                yield null;
            }
            default -> defaultRepositoryReturn(proxy, method, args);
        };
    }

    @SuppressWarnings("unchecked")
    private static <T> T repositoryProxy(Class<T> type, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] { type }, handler);
    }

    private Object defaultRepositoryReturn(Object proxy, Method method, Object[] args) {
        return defaultReturn(proxy, method, args);
    }

    private static Object defaultReturn(Object proxy, Method method, Object[] args) {
        if (method.getDeclaringClass().equals(Object.class)) {
            return switch (method.getName()) {
                case "toString" -> "RepositoryProxy";
                case "hashCode" -> System.identityHashCode(proxy);
                case "equals" -> proxy == args[0];
                default -> null;
            };
        }
        Class<?> returnType = method.getReturnType();
        if (returnType.equals(Void.TYPE)) return null;
        if (returnType.equals(Boolean.TYPE)) return false;
        if (returnType.isPrimitive()) return 0;
        if (returnType.equals(Optional.class)) return Optional.empty();
        if (returnType.equals(List.class)) return List.of();
        return null;
    }
}
