# ottline Android Native (`app.ottline` v2.0.1)

`ottline` (`ON THE TIMELINE`, `ottline.app`) 대개편(UX v2 + CI v2)에 맞춰 기존 Android TWA(`versionCode <= 23`)를 대체하는 **순수 Android Native(Kotlin + Jetpack Compose + Room + WorkManager)** 프로젝트입니다.

## 주요 특징

- **한 손 수첩 UX v2 & CI v2 디자인 시스템**
  - 따뜻한 종이 톤 라이트(`#F8F6F2`) / 다크(`#15120F`), 브랜드 네이비(`#1E4D8C`), 포인트 오렌지(`#FF9933`), `Pretendard` 타이포그래피, 열린 책+재생 심볼(`mark.svg` / Adaptive Icon) 적용
  - 6종 동화풍 스토리북 아바타(`cinema_keeper`, `book_drifter`, `deep_watcher`, `midnight_logger`, `weekend_curator`, `archive_collector`) 내장
  - 풀화면 모달(`usePlatformDefaultWidth = false`) 기반 빠른 기록 시트: 모바일 키보드 상단 고정 작품 검색창(한글 조합 중 250ms 디바운스 실시간 검색), 상태 선택 후 하단 고정 바의 **기록 남기기** 버튼으로 명확하게 저장(`봤어요·보는 중·보고 싶어요` / `읽었어요·읽는 중·읽고 싶어요`), 기본 펼침 **그날의 순간**(달력 날짜 전용, 플랫폼, 장소, 상황, 3단계 감상 느낌, 메모, 함께 화면 나누기)
  - 앱 첫 진입 시 열린 책+재생 브랜드 로고 스트로크 드로잉 인트로 애니메이션 적용
- **오프라인 우선(Local-First) + Outbox 동기화**
  - 첫 방문 시 자동 계정 생성을 강제하지 않으며, 첫 기록·기기 연결·리액션·문의 시점에만 익명 인증 발급
  - `Room`(`OttlineDatabase`) + `OutboxEntity` + `SyncWorker`(`WorkManager`)로 오프라인 작성 후 온라인 복귀 시 자동 동기화 및 서버 정규 `titleId`/`logId` 리매핑
- **전체 화면 구성**
  - **홈**: 오늘의 인사, 월 선택기, **그날의 온기**(대표 추억 카드), 이어가는 작품, **다시 만나는 그날**(자주 머문 장소·순간 타임라인 점프), 첫 방문 추천 패널
  - **타임라인**: 전체/영상/책 탭, 접이식 **그날의 순간으로 찾기** 필터, `/api/logs/page` 커서 페이지네이션, **내 미래는?**(AI 추천)
  - **작품 상세**: 작품 메타데이터, 그날의 온기, **남겨온 기록**(수정 이력), 기록 다듬기/삭제, 공유 카드, 댓글·리액션
  - **함께**: AI 큐레이터 질문(`AI 운영 계정` 고지), 공개 대화방 검색/정렬, 공감 리액션(`나도 봤어요/읽었어요`, `궁금해요`, `저장해둘래요`), `@` 작품 언급 댓글, 신고 연동
  - **내 공간 및 서브 화면**: 프로필 편집, 연결 코드 복사·**보관 카드 PNG 저장**·기기 병합(경고 포함)·연결 기기 관리, **내 이용 리포트**(리캡 카드 공유), **내 서가**(KDC `000`~`900`), **내 문의함**, **감상 후 기록 알림**, **기록 가이드**, CSV 내보내기(수식 주입 방지 + UTF-8 BOM)
- **기존 Google Play `app.ottline` TWA 100% 업그레이드 호환 및 자동 세션 복구 (`2.0.1` / `versionCode = 25`)**
  - 동일 `applicationId = "app.ottline"`, `versionCode = 25` (`2.0.1`), `minSdk = 24`, `targetSdk = 36`, `compileSdk = 36`
  - `app.ottline.LauncherActivity`, `app.ottline.QuickLogWidgetProvider`, `app.ottline.WatchReminderSettingsActivity`, `app.ottline.WatchReminderWorker`, `app.ottline.RevisitReminderWorker` 컴포넌트 및 `SharedPreferences` 키 유지
  - **1단계 (`install_token` 서버 세션 즉시 복원)**: 구버전 TWA(`versionCode <= 23`)가 `ottline.android_install.xml`에 생성해 둔 43자 Base64URL `install_token`을 감지해 `POST /api/android/notification-devices/restore-session`으로 기존 `(userId, deviceId, pairingCode)` 및 타임라인 기록을 브라우저 실행 없이 즉시 복원
  - **2단계 (`TwaBrowserBridge` 외부 브라우저 자동 핸드오프)**: 1단계 매핑이 없거나 오프라인으로만 기록했던 경우, 첫 실행 시 기존 TWA가 사용했던 브라우저 패키지(`com.google.androidbrowserhelper.trusted.PREFS_FILE.xml` 또는 `CustomTabsClient.getPackageName`)를 명시 지정해 App Link 자기 가로채기 없이 `https://ottline.app/{ko|en}?native_handoff=1`을 열고, 브라우저 `localStorage`·`IndexedDB` 세션을 동기화한 뒤 `ottline://open?handoff=1&...` 딥링크로 자동 복귀
  - **임시 계정 자동 병합**: `2.0.0`(`vc24`) 업데이트 직후 이미 새 기록을 작성한 상태에서 기존 TWA 세션이 복구되면 `pairWithCode`로 새 기록과 기존 TWA 기록을 손실 없이 자동 병합

---

## 빌드 및 테스트 명령어 (Windows PowerShell)

```powershell
# 1. 단위 테스트 및 로컬 동기화 통합 테스트 실행
.\gradlew.bat testDebugUnitTest

# 2. Debug APK 빌드 (패키지: app.ottline.dev — 기존 Play Store 앱과 동시 설치 가능, 기본 백엔드: 프리뷰 터널)
.\gradlew.bat assembleDebug

# 3. USB 연결 실기기에 Debug APK 설치 및 실행
adb install -r app\build\outputs\apk\debug\app-debug.apk
adb shell am start -n app.ottline.dev/app.ottline.LauncherActivity

# 4. Android Lint 검사
.\gradlew.bat lintDebug

# 5. Play Store 배포용 Release AAB 번들 빌드 (패키지: app.ottline, R8/ProGuard 적용, https://ottline.app 고정)
.\gradlew.bat bundleRelease -PreleaseVersionCode=25 -PreleaseVersionName=2.0.1

# 6. Release AAB의 R8/DEX 생성자 보존 및 서명 검증
powershell -ExecutionPolicy Bypass -File .\scripts\verify-release-aab.ps1
```

## 개발 서버 연결 (Debug 빌드 전용)

Debug 빌드는 기존 Play Store `app.ottline` 앱을 지우지 않고 나란히 비교할 수 있도록 기본적으로 `applicationId = "app.ottline.dev"` (`ottline v2`)로 빌드되며, **[내 공간 → Debug API Server Switcher]** 카드에서 재빌드 없이 실시간으로 대상 API 서버를 전환하고 `Ping` 테스트를 실행할 수 있습니다.

- `https://unmellow-dimple-untouchably.ngrok-free.dev` (실기기/외부 네트워크 프리뷰 터널 기본값)
- `http://172.24.75.199:3000` (호스트 로컬 WSL 프리뷰 프록시)
- `http://10.0.2.2:8080` (Android 에뮬레이터 호스트 포트)
- `http://127.0.0.1:8080` (`adb reverse tcp:8080 tcp:8080` 연결 시)
- `https://ottline.app` (프로덕션)

Release 빌드(`assembleRelease`, `bundleRelease`)에서는 평문 HTTP가 차단(`cleartextTrafficPermitted="false"`)되며 `https://ottline.app`으로 고정됩니다.

## Play Store 서명 및 배포 (`keystore.properties` / GitHub Actions)

1. **로컬 서명 빌드**: `keystore.properties.example`을 참고하여 `keystore.properties`와 `android.keystore`를 프로젝트 루트에 두면 `bundleRelease` / `assembleRelease` 실행 시 서명이 자동 적용됩니다(Git 추적 제외됨).
   ```properties
   storeFile=android.keystore
   storePassword=...
   keyAlias=android
   keyPassword=...
   ```
2. **GitHub Actions CI/CD (`.github/workflows/native-android-release.yml`)**: 기존 TWA 배포와 동일한 GitHub Secrets(`TWA_KEYSTORE_BASE64`, `TWA_KEYSTORE_PASSWORD`, `TWA_KEY_ALIAS`, `TWA_KEY_PASSWORD`, `GPLAY_SERVICE_ACCOUNT_JSON`)를 사용하여 서명된 AAB 빌드, DEX/R8 시작 계약 검증(`scripts/verify-release-aab.sh`), Google Play 트랙(`internal` / `alpha` / `beta` / `production`) 업로드를 자동 수행합니다.
3. **Play Store 그래픽 에셋 생성 (`scripts/generate_play_assets.py`)**: `output/play-store/`에 v2 브랜드 기준 `icon-512.png`, `feature-graphic-1024x500.png`, 휴대폰 스크린샷 5장(`1080x1920`)을 생성하며 `gplay images upload` 및 `gplay listings update`로 스토어 등록정보를 갱신합니다.
