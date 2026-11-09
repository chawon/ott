# ottline iOS Native v2 전환 설계 및 운영 가이드 (`apps/ios-native`)

## 1. 목적 및 배경

1. **기존 iOS 앱(`apps/native`) 현황**
   - Expo SDK 53 / React Native 0.79 기반 v1 앱(`1.0.3`, build `23` 출시 / `1.0.4`, build `24` 준비).
   - `ottline v2` 대규모 개편(`apps/web` v2 및 `apps/android-native` v2 배포 완료) 이후, 기존 React Native 코드베이스는 구버전 4탭 IA·별점 입력·구버전 색상/컴포넌트에 머물러 있음.
   - Expo EAS Build 무료 플랜의 월간 빌드 횟수/대기열 제약과 RN 브릿지 오버헤드가 존재함.
2. **순수 iOS Native(`Swift + SwiftUI`, `apps/ios-native`) 전환 목표**
   - **iOS 17.0+** 타깃의 순수 `Swift 5.10 + SwiftUI` 네이티브 앱(`apps/ios-native`)을 신설하고, 기존 `apps/native`는 레퍼런스로 보존한다.
   - 웹 v2(`apps/web`) 및 Android Native v2(`apps/android-native`)와 **100% 동일한 경험·카피·디자인 시스템(`DESIGN.md`)·오프라인 우선 동기화 계약**을 제공한다.
   - 기존 App Store 설치 사용자(`app.ottline`, Apple ID `6780318110`)가 **2.0.0 업데이트 즉시 기존 계정(`userId`, `deviceId`, `pairingCode`)과 로컬 SQLite 기록(`ottline-native.db`)을 손실 없이 자동 승계**하도록 구현한다.
   - **WidgetKit 홈 화면 위젯(`QuickLogWidget`)**을 포함해 빠른 기록·영상·책·이어보기 진입과 월간 기록 수 요약을 제공한다.
   - Public 저장소(`chawon/ott`)에서 무료·무제한 제공되는 **GitHub Actions `macos-15` 러너 + `XcodeGen` + `xcodebuild`** 파이프라인으로 CI 빌드/단위 테스트 및 TestFlight/App Store 배포를 자동화한다.

---

## 2. 앱 식별자 및 버전 정책

| 항목 | 값 | 비고 |
| --- | --- | --- |
| App Bundle Identifier | `app.ottline` | 기존 App Store 출시 앱과 동일 (업그레이드 연속성 보장) |
| Widget Extension Bundle ID | `app.ottline.QuickLogWidget` | WidgetKit 홈 화면 위젯 확장 |
| App Group Identifier | `group.app.ottline` | 메인 앱 ↔ WidgetKit 데이터 공유 컨테이너 |
| App Store Connect Apple ID | `6780318110` | 기존 프로덕션 App Store 레코드 |
| Marketing Version (`CFBundleShortVersionString`) | `2.0.0` | `ottline v2` 메이저 업데이트 |
| Build Number (`CFBundleVersion`) | `25` | `1.0.3`(`23`), `1.0.4`(`24`) 이후 단조 증가 |
| Minimum Deployment Target | `iOS 17.0` | `@Observable`, `ImageRenderer`, `WidgetKit` containerBackground 지원 |
| URL Scheme / Associated Domains | `ottline://`, `applinks:ottline.app` | 딥링크 및 유니버설 링크 호환 |

---

## 3. 기존 React Native(v1) → Swift Native(v2) 무손실 자동 마이그레이션 설계

기존 `apps/native` 사용자가 App Store에서 `2.0.0`으로 업데이트할 때 재로그인이나 연결 코드 재입력 없이 즉시 기존 타임라인과 오프라인 대기 기록을 이어받는다.

### 3.1 Keychain (`ExpoSecureStore`) 인증·설정 승계 (`LegacyIosMigrator`)
- `expo-secure-store`(`SecureStoreModule.swift`)는 iOS Keychain의 `kSecClassGenericPassword`에 다음 속성으로 값을 저장함:
  - `kSecAttrService`: `"app:no-auth"` (구버전 fallback: `"app:auth"`, `"app"`)
  - `kSecAttrGeneric` & `kSecAttrAccount`: `Data(key.utf8)`
- 첫 실행 시 `LegacyIosMigrator`가 아래 키를 조회해 `AppPreferences` Keychain/UserDefaults로 이관한다:
  - `ottline.native.userId` → `userId`
  - `ottline.native.deviceId` → `deviceId`
  - `ottline.native.pairingCode` → `pairingCode`
  - `ottline.native.analyticsClientId` → `analyticsClientId`
  - `ottline.native.localePreference` → `locale` (`ko` / `en`)
  - `ottline.native.themePreference` → `themeMode` (`light` / `dark`)

### 3.2 로컬 SQLite (`expo-sqlite` `ottline-native.db`) 무손실 이관
- `expo-sqlite`는 `<ApplicationDocumentsDirectory>/SQLite/ottline-native.db` 경로에 SQLite 파일을 생성함.
- 첫 실행 시 `LegacyIosMigrator`가 해당 파일이 존재하면 읽기 전용으로 열어 아래 테이블을 `ottline_v2.db`로 이관한다:
  1. `titles`: `json` 컬럼의 `Title` 페이로드(장르, 감독, 배우, 줄거리, ISBN13, 포스터 등)를 파싱해 `titles` 테이블에 보존.
  2. `logs`: 활성/삭제된 모든 `WatchLog` 레코드 및 `sync_status`(`SYNCED`, `PENDING`, `FAILED`)를 `watch_logs` 테이블로 이관.
  3. `history`: 남겨온 기록(`watch_log_history`) 스냅샷 전체 이관.
  4. `outbox`: 아직 서버에 푸시되지 않은 오프라인 변경분(`payload_json`)을 `outbox` 테이블로 이관하여 네트워크 연결 즉시 동기화.
  5. `settings`: `lastSyncAt`, `iosRecapNotifications.enabled` 값을 `AppPreferences`로 이관.

---

## 4. 아키텍처 및 디렉터리 구조 (`apps/ios-native`)

Xcode 프로젝트 파일(`.xcodeproj`)의 머지 충돌을 방지하고 재현 가능한 빌드를 보장하기 위해 **`XcodeGen` (`apps/ios-native/project.yml`)**을 단일 프로젝트 정의 원본(Source of Truth)으로 사용한다.

```text
apps/ios-native/
├── project.yml                         # XcodeGen 스펙 (OttlineApp, OttlineWidgetExtension, OttlineTests)
├── scripts/
│   ├── generate-assets.py              # Pretendard 폰트·아바타·아이콘 에셋 검증/생성 스크립트
│   └── verify-ios-project.sh           # 프로젝트 구조·번들 ID·암호화 수출 규정·리소스 검증 스크립트
├── Sources/
│   ├── OttlineApp/
│   │   ├── OttlineApp.swift            # @main 진입점, 스플래시, 딥링크 라우팅, 백그라운드/포그라운드 동기화
│   │   ├── Info.plist                  # CFBundleShortVersionString, ITSAppUsesNonExemptEncryption=NO, UIAppFonts
│   │   ├── OttlineApp.entitlements     # group.app.ottline, applinks:ottline.app
│   │   ├── Models/
│   │   │   └── DomainModels.swift      # 모든 도메인/API DTO 및 열거형 (Android/Web v2 100% 호환)
│   │   ├── Domain/
│   │   │   └── DomainHelpers.swift     # RecordDate, RecordFeelings, TimelineMoments, BookshelfBuilder, PersonalReportBuilder, CsvExporter, ShareIntentParser, TitleFallback
│   │   ├── Data/
│   │   │   ├── Local/
│   │   │   │   ├── AppPreferences.swift    # Keychain + UserDefaults + App Group 위젯 스냅샷 공유 + Debug 서버 스위처
│   │   │   │   ├── OttlineDatabase.swift   # 내장 SQLite3 기반 로컬 DB (titles, watch_logs, watch_log_history, outbox, book_classifications)
│   │   │   │   └── LegacyIosMigrator.swift # ExpoSecureStore Keychain & expo-sqlite ottline-native.db 자동 마이그레이터
│   │   │   ├── Remote/
│   │   │   │   └── OttlineApiClient.swift  # URLSession async/await API 클라이언트 (401 기기 해제 감지, Google Books capability 헤더 등)
│   │   │   └── OttlineRepository.swift     # Local-first 저장소, Outbox 단조 revision 동기화, LWW 충돌 해결, Analytics(platform="ios_native")
│   │   ├── Notifications/
│   │   │   └── RecapNotificationManager.swift # UNUserNotificationCenter 주간/월간 돌아보기 로컬 알림 스케줄러
│   │   ├── UI/
│   │   │   ├── Theme/
│   │   │   │   └── OttlineTheme.swift      # DESIGN.md 라이트(#F8F6F2)/다크(#15120F) 팔레트 및 Pretendard 타이포그래피
│   │   │   ├── I18n/
│   │   │   │   └── OttlineStrings.swift    # 한/영(ko/en) 양국어 카피 사전 및 tr() 헬퍼
│   │   │   ├── Components/
│   │   │   │   └── OttlineCommonComponents.swift # 브랜드 마크, 인트로 스플래시, 상/하단 바, 아바타, 포스터, 여운 아이콘, 동기화 배너
│   │   │   ├── Screens/
│   │   │   │   ├── HomeScreen.swift        # 홈(월 선택, 그날의 온기, 아직 못다 한 이야기, 다시 만나는 그날, 첫 기록 활성화, 함께/인기 작품)
│   │   │   │   ├── TimelineScreen.swift    # 타임라인(종류 탭, 그날의 순간 필터, 서버 커서 무한 스크롤, 내 미래는? 추천, CSV 내보내기)
│   │   │   │   ├── QuickRecordSheet.swift  # 빠른 기록 4단계 모달(SEARCH → STATUS → SAVED → EDIT, 3단계 여운, 시즌/회차, 플랫폼/장소/상황)
│   │   │   │   ├── TitleDetailScreen.swift # 작품 상세(그날의 온기, 다듬기, 공유 카드, 남겨온 기록 히스토리, @작품 멘션 댓글)
│   │   │   │   ├── TogetherScreen.swift    # 함께(AI 운영 계정 큐레이션, 검색/정렬, 3종 공감 칩 + 보고 싶어요 자동 기록, 이야기 상세, 신고)
│   │   │   │   ├── MySpaceScreen.swift     # 내 공간(스토리북 프로필, 연결 코드/보관 카드/기기 연결, 리포트·내 서가·문의함·가이드 진입, 로컬 초기화/서버 전체 삭제)
│   │   │   │   ├── ShareCardDialog.swift   # 9:16 스토리 / 4:5 피드 공유 카드 미리보기·저장·공유 시트
│   │   │   │   └── SubScreens.swift        # ReportScreen(주간/월간/상반기 리캡 스튜디오), BookshelfScreen(KDC 000~900), FeedbackScreen, GuideInfoScreen
│   │   │   └── Util/
│   │   │       └── CardExporter.swift      # CoreGraphics/UIKit 기반 1080×1920·1080×1350 공유 카드, 리캡 모자이크 카드, 연결 코드 보관 카드 렌더러
│   │   └── Resources/
│   │       ├── Assets.xcassets/            # AppIcon, 6종 스토리북 페르소나 아바타 PNG
│   │       └── Fonts/                      # Pretendard Regular/Medium/SemiBold/Bold/ExtraBold OTF
│   └── OttlineWidget/
│       ├── QuickLogWidget.swift            # WidgetKit Small/Medium 홈 화면 위젯 (빠른 기록/영상/책/이어보기 딥링크)
│       ├── Info.plist
│       └── OttlineWidget.entitlements      # group.app.ottline
└── Tests/
    └── OttlineTests/
        └── OttlineCoreTests.swift          # 도메인 헬퍼, 로컬 DB, Outbox revision, Legacy Keychain/SQLite 마이그레이션, KDC 서가, CSV, API 클라이언트 테스트
```

---

## 5. API 및 Analytics 계약 영향

1. **백엔드 API/DB 스키마 변경 없음**
   - 기존 `/api/*` 엔드포인트와 100% 동일한 계약을 사용한다.
   - 헤더: `X-User-Id`, `X-Device-Id`, `Accept-Language: ko|en`, 도서 검색 시 `X-Book-Search-Capability: google_books_v1`.
2. **Analytics 이벤트 계약 (`POST /api/analytics/events`)**
   - `platform`: 반드시 `"ios_native"` 전송 (DB 체크 제약조건 `^(web|pwa|twa|ios_native)$` 준수).
   - 기본 프로퍼티: `osFamily: "ios"`, `deviceType: "mobile" | "tablet"`, `installState: "app_store_testflight"`, `appVersion: "2.0.0"`, `buildNumber: "25"`, `sessionId`, `installId`, `locale`, `theme`.
3. **디자인 시스템(`DESIGN.md` & `.omd/preferences.md`) 준수**
   - 배경: 라이트 `#F8F6F2` (Warm Cream), 다크 `#15120F` (Warm Espresso). 순백색(`#FFFFFF`)은 카드 표면에만 사용.
   - 오렌지(`#FF9933`) 예산: 하단 중앙 `+` 기록 버튼, 최종 제출 CTA(`기록 남기기`, `#0F0F0F` 텍스트), 활성 하단 탭 상단 `15×2pt` 마이크로 마커, 워드마크 서브타이틀(`ON THE TIMELINE`)에만 제한 사용.
   - KDC 내 서가(`000`~`900`): 한국어(`locale == "ko"`)일 때만 `/api/titles/book-classifications/resolve`를 호출하고 `000`..`900` 숫자 순서를 유지한다.
   - 낙장불입 정책: 개별 기록 삭제 UI 없음(`다듬기` 수정 및 `남겨온 기록` 히스토리 제공). 설정(`내 공간`)에서 이 기기 기록만 비우기(로컬 초기화)와 서버 데이터 전체 삭제(`DELETE /api/auth/account`)를 분리 제공한다.

---

## 6. GitHub Actions (`macos-15`) CI 및 TestFlight 배포 파이프라인

1. **PR / Push CI (`.github/workflows/native-ios-v2-ci.yml`)**
   - `macos-15` 러너에서 실행 (Public 저장소 무료·무제한).
   - `scripts/verify-ios-project.sh` 정적 검증 → `xcodegen generate` → `xcodebuild test` (iOS Simulator에서 `OttlineApp`, `OttlineWidgetExtension` 빌드 및 `OttlineTests` 전체 실행).
2. **TestFlight / App Store 릴리스 (`.github/workflows/native-ios-v2-release.yml`)**
   - `workflow_dispatch` 수동 실행 (`version_name`, `build_number`, `submit_to_testflight` 입력).
   - `macos-15` 러너에서 단위 테스트 통과 후 Archive 생성.
   - GitHub Secrets(`IOS_DIST_CERT_BASE64`, `IOS_DIST_CERT_PASSWORD`, `IOS_PROVISION_PROFILE_BASE64`, `IOS_WIDGET_PROVISION_PROFILE_BASE64`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY_BASE64`)가 설정된 경우 코드 서명된 `.ipa`를 익스포트하여 `xcrun altool` / `notarytool` / App Store Connect API로 TestFlight에 즉시 업로드한다.
   - 기존 EAS에 저장된 Apple 인증서/프로비저닝 프로필을 GitHub Secrets로 1회 추출하는 가이드는 `apps/ios-native/DEVELOPMENT.md`에 문서화한다.
