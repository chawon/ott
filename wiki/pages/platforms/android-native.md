# Android Native (`apps/android-native`)

> `2026-11-09`(`v2.0.0` `vc24` / `v2.0.1` `vc25`)부터 기존 Bubblewrap TWA를 대체해 Google Play `app.ottline` 프로덕션에 배포되는 순수 Android Native(Kotlin + Jetpack Compose + Room + WorkManager) 앱

## 관련 페이지
- [[ottline-v2]]
- [[twa]]
- [[pwa]]
- [[personal-profile]]
- [[future-timeline]]

---

## 현재 상태 (`2026-11-09`)

- **패키지명**: `app.ottline` (Debug 빌드는 기존 앱과 동시 설치 가능하도록 `app.ottline.dev`)
- **최신 프로덕션 버전**: `2.0.1` (`versionCode = 25`, `status = completed`, 100%)
- **최소/타겟 SDK**: `minSdk = 24` (Android 7.0), `targetSdk = 36`, `compileSdk = 36`
- **소스 경로**: `apps/android-native/`
- **GitHub Actions**:
  - `.github/workflows/native-android-ci.yml` (PR/main 단위 테스트·Lint·Debug APK 빌드)
  - `.github/workflows/native-android-release.yml` (서명 Release AAB 빌드, DEX/R8 계약 검증 `scripts/verify-release-aab.sh`, `gplay release` 자동 배포)

---

## 핵심 아키텍처 및 UX v2 구성

1. **한 손 수첩 UX v2 & 풀화면 빠른 기록 모달 (`QuickLogModal.kt`)**
   - 따뜻한 종이 톤 라이트(`#F8F6F2`) / 다크(`#15120F`), 브랜드 네이비(`#1E4D8C`), 포인트 오렌지(`#FF9933`), `Pretendard` 타이포그래피, 열린 책+재생 심볼 및 6종 동화풍 스토리북 아바타 내장.
   - 풀화면 다이얼로그(`usePlatformDefaultWidth = false`)로 작품 선택 시 팝업 축소나 하단 잘림 없이 동작.
   - 상태 선택(`봤어요·보는 중·보고 싶어요` / `읽었어요·읽는 중·읽고 싶어요`)과 저장을 분리하고, 하단 고정 바의 **기록 남기기** 버튼으로 명시적 저장.
   - **그날의 순간**(달력 날짜, 플랫폼, 장소, 상황, 3단계 감상 느낌, 메모, 함께 화면 나누기) 섹션을 기본 펼침 상태로 표시.
2. **오프라인 우선(Local-First) + Outbox 동기화**
   - `Room`(`OttlineDatabase`) + `OutboxEntity` + `SyncWorker`(`WorkManager`)로 오프라인 작성 후 온라인 복귀 시 자동 push/pull 동기화 및 서버 정규 ID 리매핑.
3. **기존 TWA 컴포넌트 100% 호환**
   - `app.ottline.LauncherActivity`, `app.ottline.QuickLogWidgetProvider`, `app.ottline.WatchReminderSettingsActivity`, `app.ottline.WatchReminderWorker`, `app.ottline.RevisitReminderWorker` 컴포넌트 명칭과 `SharedPreferences` 키 유지.

---

## 기존 TWA(`versionCode <= 23`) → 네이티브 업데이트 자동 세션·기록 복구 (`2.0.1` / `vc25`)

기존 TWA는 사용자 세션을 브라우저(`https://ottline.app`) `localStorage`/`IndexedDB`에 저장했기 때문에, 네이티브 업데이트 첫 실행 시 아래 **2단계 자동 복구**로 기존 기록과 프로필을 이어받는다.

1. **1단계 — 백그라운드 `install_token` 서버 세션 즉시 복원 (`OttlineRepository.tryRestoreFromTwaInstallToken`)**
   - 앱 내부 `shared_prefs/ottline.android_install.xml`에 남아 있는 구버전 TWA의 43자 Base64URL `install_token`을 감지해 `POST /api/android/notification-devices/restore-session`을 호출한다.
   - 서버 `android_notification_devices`에 매핑된 기존 `(userId, deviceId, pairingCode, nickname, personaKey)`를 브라우저 실행 없이 즉시 복원하고 타임라인을 동기화한다.
2. **2단계 — `TwaBrowserBridge` 외부 브라우저 자동 핸드오프**
   - 1단계 매핑이 없거나 오프라인으로만 기록했던 경우, `TwaBrowserBridge.resolveExternalBrowserPackage`가 기존 TWA 브라우저 패키지(`com.google.androidbrowserhelper.trusted.PREFS_FILE.xml` 기록 → `CustomTabsClient.getPackageName` → `CustomTabsService` 지원 브라우저 순, `app.ottline` 자신은 제외)를 특정해 `https://ottline.app/{ko|en}?native_handoff=1`을 연다.
   - 웹(`<head>` 인라인 스크립트 및 `AndroidAppContextRecorder.tsx`)이 `localStorage`·`IndexedDB` 세션을 동기화한 뒤 `ottline://open?handoff=1&status=ok&...` 딥링크로 네이티브 앱에 즉시 되돌려준다.
3. **임시 계정 자동 병합 (`OttlineRepository.completeTwaHandoff`)**
   - `2.0.0`(`vc24`)에서 이미 임시 계정에 새 기록을 작성한 상태에서 기존 TWA 세션이 복구되면 `pairWithCode`로 새 기록과 기존 TWA 기록을 손실 없이 병합한다.

---

## 프로덕션 배포 이력 (`2026-11-09`)

- **`2.0.0` (`versionCode = 24`)**: main SHA `45ccac3b797a29bf78691e52972748b1a9cf3a47`, Android Release Run `42550886641` (`production` 트랙 `completed`), Play edit `12908968039807814595`로 v2 신규 아이콘(`512x512`)·피처 그래픽(`1024x500`)·스크린샷 5장(`1080x1920`) 및 스토어 문구 반영.
- **`2.0.1` (`versionCode = 25`)**: main SHA `916be7abe9a8712d3f5a0a5e460a7bf820e23b0c`, API Run `42564733989`, Web Run `42564731554`, Android Release Run `42564729159` (`production` 트랙 `completed`), Play edit `18276584036455797705`로 `ko-KR`/`en-US` 출시 노트 반영.
