# macOS Native 기기 구분 (`macos_native`) API 작업 가이드

## 1. 배경 및 원인

macOS 네이티브 앱(`apps/macos-native`)으로 연결된 기기가 웹(`내 공간`)과 앱에서 `iOS App · iOS`로 표시되던 원인은 두 가지입니다.

1. **클라이언트 헤더 (수정 완료)**: 공유 패키지 `OttlineCore`의 `OttlineApiClient.swift`가 macOS 빌드에서도 `X-Client-Platform: ios_native`를 전송하고 있었습니다.
   - macOS 빌드(`#if os(macOS)`)에서는 **`X-Client-Platform: macos_native`**와 **`User-Agent: ottline-mac/<appVersion> (Macintosh; Mac OS X)`**를 보내도록 수정했습니다.
   - iOS 빌드에서는 기존과 동일하게 `X-Client-Platform: ios_native`를 전송합니다.
2. **백엔드 기기 판별 로직 (`apps/api`, API 담당자 수정 필요)**: `AuthService.applyAgentInfo(...)`에 `ios_native` 분기만 있어:
   - 수정 전: `X-Client-Platform: ios_native`를 받아 `os = "iOS"`, `browser = "iOS App"`으로 저장
   - 백엔드 수정 전 + 클라이언트만 변경 시: `parseOs`가 User-Agent에서 `"macOS"`는 잡지만 `parseBrowser`가 웹 브라우저(`Edge/Chrome/Safari/Firefox/Opera`)만 구분하므로 **`os = "macOS"`, `browser = "Unknown Browser"`**로 저장됨 (`웹`에 `Unknown Browser · macOS`로 노출).

---

## 2. 백엔드 필수 수정 사항 (`AuthService.java`)

대상 파일: `apps/api/src/main/java/com/watchlog/api/service/AuthService.java` (lines 217–233)

`applyAgentInfo(UserDeviceEntity device, String userAgent, String clientPlatform)`에 `macos_native` 판별 분기를 추가해 주세요.

```java
    private void applyAgentInfo(UserDeviceEntity device, String userAgent, String clientPlatform) {
        if (isIosNativeClient(clientPlatform)) {
            device.setUserAgent(normalizeMetadata(userAgent, clientPlatform));
            device.setOs("iOS");
            device.setBrowser("iOS App");
            return;
        }
        if (isMacosNativeClient(clientPlatform)) {
            device.setUserAgent(normalizeMetadata(userAgent, clientPlatform));
            device.setOs("macOS");
            device.setBrowser("macOS App");
            return;
        }
        if (userAgent == null || userAgent.isBlank()) return;
        device.setUserAgent(userAgent);
        device.setOs(parseOs(userAgent));
        device.setBrowser(parseBrowser(userAgent));
    }

    private boolean isIosNativeClient(String clientPlatform) {
        return clientPlatform != null && clientPlatform.trim().equalsIgnoreCase("ios_native");
    }

    private boolean isMacosNativeClient(String clientPlatform) {
        return clientPlatform != null && clientPlatform.trim().equalsIgnoreCase("macos_native");
    }
```

### 기존 기기 자동 갱신 (재연결/마이그레이션 불필요)

`AuthController.devices()`(`GET /api/auth/devices`)가 호출될 때마다 아래 경로로 `last_seen_at` 및 `os`·`browser`를 갱신합니다.

- `apps/api/src/main/java/com/watchlog/api/web/AuthController.java:53`: `authService.touchDevice(userId, deviceId, userAgent, clientPlatform);`

따라서 API 반영 이후 **macOS 앱이 한 번이라도 `/api/auth/devices`를 호출하면**, DB에 이미 `iOS / iOS App`(또는 `macOS / Unknown Browser`)으로 저장되어 있던 Mac 기기 행이 자동으로 **`os = "macOS"`, `browser = "macOS App"`**으로 업데이트됩니다. 별도 DB 마이그레이션이나 재페어링은 필요 없습니다.

---

## 3. 다른 API 엔드포인트 영향도

1. **도서 검색 (`TitleController.java:46`, `GET /api/titles/search`)**
   - `boolean legacyNative = "ios_native".equals(platform) && !"google_books_v1".equals(bookSearchCapability);`
   - macOS 클라이언트는 `X-Book-Search-Capability: google_books_v1` 헤더를 항상 함께 전송하므로, `X-Client-Platform: macos_native`에서도 한국어(Kakao) / 영어(Google Books) 도서 검색 분기가 정상 동작합니다.
2. **애널리틱스 (`TrackAnalyticsEventRequest.java:17`, `V27__ios_native_analytics_platform.sql:6`)**
   - 현재 DB `CHECK` 제약과 DTO `@Pattern`은 `('web', 'pwa', 'twa', 'ios_native')`만 허용합니다.
   - 이를 고려해 macOS 클라이언트는 `POST /api/analytics/events` 바디의 `platform` 값을 기존 `"ios_native"`로 유지하고, `properties.osFamily = "macos"`, `properties.deviceType = "desktop"`으로 구분 전송하고 있습니다 (`OttlineRepository.swift:758-788`).
   - 추후 관리자 통계(`AnalyticsService.java`)에서 `macos_native`를 최상위 플랫폼으로 분리 집계하고 싶다면, 그때 Flyway 마이그레이션으로 DB CHECK 제약을 확장하고 `TrackAnalyticsEventRequest` 정규식에 `macos_native`를 추가한 뒤 클라이언트와 맞춰 전환하면 됩니다. (이번 기기 표시 수정에는 불필요합니다.)

---

## 4. 백엔드 단위 테스트 예시 및 검증 명령

대상 파일: `apps/api/src/test/java/com/watchlog/api/service/AuthServiceProfileTest.java`

기존 `registerStoresIosNativeDeviceInfoFromClientPlatform()`, `touchDeviceRefreshesIosNativeDeviceInfo()` 아래에 아래 테스트를 추가하면 회귀를 검증할 수 있습니다.

```java
    @Test
    void registerStoresMacosNativeDeviceInfoFromClientPlatform() {
        authService.register("ottline-mac/2.0.0 (Macintosh; Mac OS X)", "macos_native");

        assertThat(lastSavedDevice).isNotNull();
        assertThat(lastSavedDevice.getUserAgent()).isEqualTo("ottline-mac/2.0.0 (Macintosh; Mac OS X)");
        assertThat(lastSavedDevice.getOs()).isEqualTo("macOS");
        assertThat(lastSavedDevice.getBrowser()).isEqualTo("macOS App");
    }

    @Test
    void touchDeviceRefreshesExistingDeviceToMacosNative() {
        var user = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
        var device = new UserDeviceEntity(UUID.randomUUID(), user);
        device.setOs("iOS");
        device.setBrowser("iOS App");
        devices.put(device.getId(), device);

        authService.touchDevice(user.getId(), device.getId(), "ottline-mac/2.0.0 (Macintosh; Mac OS X)", "macos_native");

        assertThat(device.getUserAgent()).isEqualTo("ottline-mac/2.0.0 (Macintosh; Mac OS X)");
        assertThat(device.getOs()).isEqualTo("macOS");
        assertThat(device.getBrowser()).isEqualTo("macOS App");
    }
```

### 실행 검증

```bash
cd apps/api
./gradlew test --tests com.watchlog.api.service.AuthServiceProfileTest
```
