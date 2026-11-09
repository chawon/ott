# Android Native v2 전환 및 TWA 자동 세션 복구 기록

기준일: `2026-11-09`
대상 경로: `apps/android-native`, `apps/web`, `apps/api`, `.github/workflows/native-android-ci.yml`, `.github/workflows/native-android-release.yml`

---

## 1. 배경 및 전환 목표

기존 Google Play `app.ottline`(`versionCode <= 23`, `1.0.19`)은 Bubblewrap 기반 TWA(`apps/twa`)로 운영되었으나, `ottline v2`(한 손 수첩 UX v2 + CI v2) 개편에 맞춰 다음 목표를 달성하기 위해 **순수 Android Native(`Kotlin + Jetpack Compose + Room + WorkManager`)** 프로젝트(`apps/android-native`)로 전면 전환했다.

1. **오프라인 우선(Local-First) 및 즉각적인 네이티브 반응성**: 네트워크 지연이나 브라우저 탭 초기화를 기다리지 않고 `Room`(`OttlineDatabase`) + `OutboxEntity` + `SyncWorker`(`WorkManager`)로 오프라인에서도 즉시 검색·기록·조회가 가능하도록 구성.
2. **기존 Google Play `app.ottline` 100% 업그레이드 호환**: 패키지명(`app.ottline`), 서명 키스토어(`android.keystore`), 매니페스트 진입 컴포넌트(`LauncherActivity`, `QuickLogWidgetProvider`, `WatchReminderSettingsActivity`, `WatchReminderWorker`, `RevisitReminderWorker`) 및 `SharedPreferences` 파일을 그대로 유지.
3. **기존 TWA 사용자 데이터·계정 무손실 자동 이어받기**: TWA(`versionCode <= 23`)에서 업데이트한 사용자가 첫 실행 시 별도의 수동 코드 입력 없이도 기존 기록, 연결 코드(`pairingCode`), 프로필(`nickname`, `personaKey`)을 자동으로 복원·병합.

---

## 2. 주요 아키텍처 및 UX v2 반영 사항 (`apps/android-native`)

### 2.1 한 손 수첩 UX v2 & 풀화면 빠른 기록 모달
- **테마 및 브랜드 자산**: 따뜻한 종이 톤 라이트(`#F8F6F2`) / 다크(`#15120F`), 브랜드 네이비(`#1E4D8C`), 포인트 오렌지(`#FF9933`), `Pretendard` 타이포그래피, 열린 책+재생 브랜드 심볼(`mark.svg` / Adaptive Icon)과 6종 동화풍 스토리북 아바타 내장.
- **빠른 기록(`QuickLogModal`)**:
  - 풀화면(`DialogProperties(usePlatformDefaultWidth = false)` + `fillMaxSize()`) 구성으로 작품을 선택한 뒤에도 모달 높이가 줄어들거나 하단 영역이 잘리지 않음.
  - 모바일 웹 v2와 동일하게 **상태 선택(`봤어요·보는 중·보고 싶어요` / `읽었어요·읽는 중·읽고 싶어요`)과 저장 행위를 분리**하고, 하단 고정 액션 바(`navigationBarsPadding` + `imePadding`)의 **기록 남기기** 버튼으로 명확하게 저장.
  - 풀화면 전환에 맞춰 **그날의 순간**(달력 날짜, 플랫폼, 장소, 상황, 3단계 감상 느낌, 메모, 함께 화면 나누기) 섹션을 기본 펼침(`showMoments = true`) 상태로 노출.

### 2.2 전체 탭 및 로컬 우선 동기화
- **홈 / 타임라인 / 작품 상세 / 함께 / 내 공간**:
  - 홈: 오늘의 인사, 월 선택기, `그날의 온기` 대표 추억 카드, `이어가는 작품`, `다시 만나는 그날`, 첫 방문 추천 패널.
  - 타임라인: 전체/영상/책 탭, 접이식 `그날의 순간으로 찾기` 필터, `/api/logs/page` 커서 페이지네이션, `내 미래는?`(OpenAI 기반 맞춤 추천, 계정별 제외·되돌리기·하루 3회 제한).
  - 함께: AI 큐레이터 질문(`AI 운영 계정` 고지), 공개 대화방 검색/정렬, 공감 리액션(`나도 봤어요/읽었어요`, `궁금해요`, `저장해둘래요`), `@` 작품 언급 댓글, 신고 연동.
  - 내 공간 및 서브 화면: 프로필 편집, 연결 코드 복사·**보관 카드 PNG 저장**·기기 병합(경고 포함)·연결 기기 관리, **내 이용 리포트**(리캡 카드 공유), **내 서가**(KDC `000`~`900`), **내 문의함**, **감상 후 기록 알림**(UsageStats 기반), **기록 가이드**, CSV 내보내기.

---

## 3. 기존 TWA → 네이티브 업데이트 시 2단계 자동 세션·기록 복구 (`2.0.1` / `versionCode 25`)

### 3.1 문제 원인
1. 기존 TWA(`versionCode <= 23`)는 사용자 세션(`watchlog.userId`, `watchlog.deviceId`, `watchlog.pairingCode`, `watchlog.profile.v1`)을 Chrome Custom Tab 브라우저의 `https://ottline.app` `localStorage`/`IndexedDB`에 저장한 반면, 네이티브 앱(`versionCode 24`)은 Android `SharedPreferences`(`ottline.native_prefs`)와 Room DB를 조회해 신규 사용자로 시작됨.
2. 또한 네이티브 앱의 `AndroidManifest.xml`에 `https://ottline.app`에 대한 `android:autoVerify="true"` App Link가 선언되어 있어, 외부 브라우저 패키지명을 명시하지 않고 `CustomTabsIntent`를 호출하면 Chrome 대신 네이티브 `LauncherActivity`가 자기 자신을 다시 가로채는 현상이 발생함.

### 3.2 해결 구조 (2단계 자동 복구 + 임시 계정 자동 병합)

1. **1단계 — 백그라운드 `install_token` 기반 서버 세션 즉시 복원 (브라우저 실행 불필요)**
   - 구버전 TWA(`AndroidInstallToken.java`)는 앱 내부 `shared_prefs/ottline.android_install.xml`에 43자 Base64URL 형식의 고유 `install_token`을 생성하고, 웹(`AndroidAppContextRecorder.tsx`)이 `sha256(install_token)`을 서버 `android_notification_devices` 테이블의 `(user_id, device_id)`에 매핑해 두었다.
   - 네이티브 첫 실행 시 `AndroidInstallToken.hasTwaUpgradeSignal(context)`가 기존 TWA 토큰 또는 업그레이드 흔적을 감지하면 `OttlineRepository.tryRestoreFromTwaInstallToken()`이 신규 API `POST /api/android/notification-devices/restore-session`을 호출해 기존 `(userId, deviceId, pairingCode, nickname, personaKey)`를 즉시 복원하고 전체 타임라인 기록을 동기화한다.

2. **2단계 — `TwaBrowserBridge` 외부 브라우저(`CustomTabs`) 자동 핸드오프**
   - 알림 디바이스 등록 이전에 업데이트했거나 오프라인으로만 기록했던 사용자의 경우, 첫 실행 시 `TwaBrowserBridge.launchTwaHandoff(context, locale)`가 자동으로 실행된다.
   - **브라우저 결정 기준 (`TwaBrowserBridge.resolveExternalBrowserPackage`)**:
     1. **1순위**: 구버전 TWA 라이브러리(`com.google.androidbrowserhelper:androidbrowserhelper`)가 `shared_prefs/com.google.androidbrowserhelper.trusted.PREFS_FILE.xml`에 저장해 둔 브라우저 패키지명(평문 또는 Base64 디코딩)을 직접 조회.
     2. **2순위**: 기존 TWA 런처(`TwaProviderPicker`)와 동일한 `CustomTabsClient.getPackageName(context, PREFERRED_BROWSERS, true)`로 기본 Custom Tabs 브라우저 조회.
     3. **3순위**: `android.support.customtabs.action.CustomTabsService` 인텐트 서비스 지원 브라우저 조회 (`Chrome` → `삼성 인터넷` → `Edge` → `Brave` → `웨일` → `Firefox` → `Opera` 순).
     4. **4순위**: 일반 `http://` VIEW 인텐트 처리 브라우저 폴백 (`app.ottline` 자기 자신은 제외).
   - 선택된 브라우저 패키지를 `customTabsIntent.intent.setPackage(browserPkg)`로 명시하여 `https://ottline.app/{ko|en}?native_handoff=1`을 열면, 웹의 `<head>` 즉시 실행 스크립트(`apps/web/app/[locale]/layout.tsx`)와 `AndroidAppContextRecorder.tsx`가 브라우저 `localStorage`·`IndexedDB`의 미동기화 기록까지 서버에 동기화한 뒤 `ottline://open?handoff=1&status=ok&user_id=...&device_id=...&pairing_code=...&nickname=...&persona_key=...` 딥링크로 네이티브 앱에 세션을 즉시 전달한다.

3. **임시 계정 자동 병합 (`OttlineRepository.completeTwaHandoff`)**
   - 만약 사용자가 `2.0.0`(`vc24`) 업데이트 직후 임시 계정에 이미 새 기록을 작성한 상태에서 기존 TWA 세션이 복구되면, `pairWithCode(twaPairingCode)`를 호출해 새 기록과 기존 TWA 기록을 손실 없이 하나로 병합한다.
   - 홈, 내 공간, 설정/페어링 화면에도 언제든 원탭으로 다시 실행할 수 있는 **"기존 기록 자동 연결"** 버튼을 함께 제공한다.

---

## 4. CI/CD 및 Google Play 프로덕션 배포 이력 (`2026-11-09`)

### 4.1 GitHub Actions 워크플로우
- **PR/main 검증 CI**: `.github/workflows/native-android-ci.yml` (`testDebugUnitTest`, `lintDebug`, `assembleDebug`)
- **서명 AAB 빌드 및 Google Play 배포**: `.github/workflows/native-android-release.yml`
  - `testDebugUnitTest`, `lintDebug`, `bundleRelease` 실행
  - `scripts/verify-release-aab.sh`로 `WorkDatabase_Impl.<init>()` 및 `OttlineDatabase_Impl.<init>()` DEX 보존과 5개 필수 매니페스트 컴포넌트 검증
  - `gplay release`로 지정 트랙(`internal` / `alpha` / `beta` / `production`) 자동 배포 및 서명 AAB + R8 `mapping.txt` 아티팩트 업로드

### 4.2 배포 타임라인 (`2026-11-09`)
1. **`2.0.0` (`versionCode = 24`) 모노레포 통합 및 프로덕션 출시**:
   - Main SHA: `45ccac3b797a29bf78691e52972748b1a9cf3a47`
   - Android Release Run: [`42550886641`](https://github.com/chawon/ott/actions/runs/42550886641) (`production` 트랙 `completed`)
2. **Google Play 스토어 등록정보 및 v2 그래픽 에셋 업데이트**:
   - `ko-KR` / `en-US` 스토어 설명 및 출시 노트 업데이트, v2 신규 아이콘(`512x512`), 피처 그래픽(`1024x500`), 네이티브 휴대폰 스크린샷 5장(`1080x1920`) 반영 완료 (Play edit `12908968039807814595`).
3. **`2.0.1` (`versionCode = 25`) TWA 자동 세션·기록 복구 배포 (API + Web + Android Native)**:
   - Main SHA: `916be7abe9a8712d3f5a0a5e460a7bf820e23b0c`
   - API Production Run: [`42564733989`](https://github.com/chawon/ott/actions/runs/42564733989) (`POST /api/android/notification-devices/restore-session` 및 `UserProfileDto.pairingCode` 추가)
   - Web Production Run: [`42564731554`](https://github.com/chawon/ott/actions/runs/42564731554) (`?native_handoff=1` `<head>` 즉시 리다이렉트 및 `AndroidAppContextRecorder` IndexedDB 동기화 핸드오프)
   - Android Native Production Run: [`42564729159`](https://github.com/chawon/ott/actions/runs/42564729159) (`versionName = "2.0.1"`, `versionCode = 25`, `production` 트랙 `completed`, Play edit `18276584036455797705` 출시 노트 반영 완료)
