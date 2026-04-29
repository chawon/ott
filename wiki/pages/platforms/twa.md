# TWA (Trusted Web Activity)

> 현재 Android 배포에 사용하는 Bubblewrap 기반 TWA 프로젝트 — `apps/twa/`

## 관련 페이지
- [[pwa]]
- [[ms-store]]

---

## 현재 상태

**Android 배포 현행 경로는 TWA다.**

- 패키지명: `app.ottline`
- 도메인: `https://ottline.app`
- 런처명: `ottline`
- GitHub Actions:
  - `.github/workflows/twa-debug.yml`
  - `.github/workflows/twa-build-aab.yml`
  - `.github/workflows/twa-release.yml`
- Play 배포 이력:
  - internal track 배포 성공 (`versionName=1.0.0`, `versionCode=4`)
  - `twa-release.yml` 기준 `gplay release` 자동 업로드 경로 유지
- 현재 운영 상태(2026-04-29):
  - `versionName=1.0.4`, `versionCode=8` AAB 빌드 완료
  - Play `alpha` 트랙에 `8 (1.0.4)` 반영 완료
  - 런처 shortcuts, PWA/TWA Web Share Target, 홈 위젯 영상/책/타임라인 액션 분리 반영
  - Google Play `alpha` 비공개 테스트(Closed testing) 시작
  - 비공개 테스트 테스터 그룹: `ottline-beta-testers@googlegroups.com`
- 현재 작업환경 재검증(2026-04-17):
  - 로컬 `./gradlew assembleDebug`는 WSL/ARM 환경의 `aapt2` 바이너리 호환 문제로 실패
  - 따라서 Android APK/AAB는 계속 GitHub Actions를 source of truth로 사용

## 히스토리 요약

1. 2026-01: `feature/flutter-android`
   - `apps/mobile` Flutter 앱과 debug APK CI만 존재
   - Play release/signing 경로는 완성되지 않음
2. 2026-02: `apps/twa`
   - Bubblewrap TWA가 실제 Android 배포 경로가 됨
   - 공유 인텐트, 홈 위젯, internal track 업로드까지 완료
3. 2026-03: 문서상 `TWA -> Capacitor` 결정이 기록됨
   - 저장소에는 `apps/cap`이나 Capacitor 설정이 없음
   - 즉, 코드 실체 없는 문서 결정만 남아 있던 상태
4. 2026-03~04: `feat/native-mobile-app`
   - `apps/native` React Native + Expo 후보 앱 추가
   - main 미머지, EAS/Play/TestFlight 파이프라인 없음

---

## 배포 기준 정보

- 패키지명: `app.ottline`
- 도메인: `https://ottline.app`
- 앱명: `ottline`

---

## Google Play 배포 현황

- 내부 테스트 트랙 배포 이력 있음 (`track=internal`, `versionName=1.0.0`, `versionCode=4`)
- 2026-04-29 기준 최신 반영:
  - `internal`: `6 (1.0.2)`, `status=completed`
  - `alpha`: `8 (1.0.4)`, `status=completed`
  - `alpha` 비공개 테스트 시작
  - 테스터 그룹: `ottline-beta-testers@googlegroups.com`
- GitHub Actions `twa-release.yml` — AAB 빌드 후 `gplay release`
- 관련 Secret:
  - `TWA_KEYSTORE_BASE64`
  - `TWA_KEYSTORE_PASSWORD`
  - `TWA_KEY_ALIAS`
  - `TWA_KEY_PASSWORD`
  - `GPLAY_SERVICE_ACCOUNT_JSON`

---

## 공유 인텐트 / Web Share Target (2026-02-15, 2026-04-29 갱신)

Android `ACTION_SEND` 수신 → 웹앱에 `shared_text`, `shared_subject` 쿼리 전달 → QuickLog 검색창 자동 프리필

2026-04-29 `1.0.4` alpha에서는 PWA manifest와 TWA metadata에 Web Share Target을 명시하고, URL 공유용 `shared_url`도 홈 QuickLog 입력으로 병합한다. Next metadata `manifest.ts`는 live JSON에 `share_target`을 노출하지 않아 `/manifest.webmanifest`를 route handler로 전환했고, web production deploy run `25090523988` 이후 live manifest에서 `share_target` 노출을 확인했다.

**지원 OTT 파서:**
- Netflix, Disney+, Prime Video, Apple TV, TVING, Coupang Play, WATCHA
- 파서 위치: `apps/web/lib/shareIntent.ts`
- URL 리졸버: `apps/web/app/share-resolve/route.ts` (allowlist 도메인만 HTML 메타 파싱)

---

## Android 홈 화면 위젯 (2026-02-18, 2026-04-29 갱신)

- `빠른 기록` 위젯
- 액션:
  - `영상` → `/?quick=1&quick_type=video&quick_focus=1`
  - `책` → `/?quick=1&quick_type=book&quick_focus=1`
  - `타임라인` → `/timeline`
- 위치: `apps/twa/app/src/main/java/app/ottline/QuickLogWidgetProvider.java`

## Android 런처 Shortcuts (2026-04-29, 1.0.4 alpha)

- `기록하기` → `/?quick=1&quick_focus=1`
- `영상 기록` → `/?quick=1&quick_type=video&quick_focus=1`
- `책 기록` → `/?quick=1&quick_type=book&quick_focus=1`
- `타임라인` → `/timeline`

---

## Asset Links 설정

`apps/web/public/.well-known/assetlinks.json`에 release keystore SHA-256 fingerprint 등록 필요

현재 등록된 fingerprint:
- `FF:83:9F:7B:63:74:47:2D:D4:EF:5F:B4:4A:0E:6A:54:4F:5D:A9:A6:79:C5:FA:05:C0:6F:63:B8:E3:07:A3:36`
- `0E:25:31:CD:8B:18:6B:F3:5D:7C:10:13:7B:AC:FA:D0:97:42:52:A5:13:0E:43:E6:3C:5F:4B:04:88:66:56:66`
- `5A:B6:69:AB:DA:C1:22:68:06:F3:9B:EE:C2:45:F3:88:43:2A:53:9D:B2:15:44:D7:82:90:68:20:7D:F3:59:70`

---

## Play 스토어 등록정보 기준

- **앱 이름:** `ottline`
- **짧은 설명:** 영화·시리즈·책 기록을 남기고 나만의 타임라인으로 모아보세요.
- **카테고리:** Lifestyle
- **연락처 이메일:** `contact@ottline.app`
- **개인정보처리방침:** `https://ottline.app/privacy`
- **브랜딩 규칙:** 이번 출시에서는 `ott.preview.pe.kr`, `On the Timeline`, 구 아이콘/구 스크린샷을 다시 쓰지 않음
- **상세 입력 문서:** `docs/twa-play-store-listing-ko.md`

## App Content 등록 기준

- Ads: 현재 기준 `No`
- App access: 핵심 기록 기능은 로그인 없이 리뷰 가능
- Data safety: Privacy 페이지와 실제 수집 항목이 일치해야 함
- Content rating: IARC 설문 기준으로 확정
- Target audience: 어린이 전용 앱으로 제출하지 않음

---

## 빌드 방식

- WSL ARM Linux 환경에서 로컬 Android 빌드 비권장 (호환 문제)
- APK/AAB는 GitHub Actions에서 생성 후 아티팩트 다운로드
- 로컬 확인이 필요하면 `GRADLE_USER_HOME=./.gradle`로 워크스페이스 캐시를 분리

---

## 후속 후보

- `feat/native-mobile-app`
  - React Native + Expo 후보 앱
  - `app.ottline.native` 패키지 사용
  - 현재는 Expo Go/웹 실행과 API 연동 단계
  - Android 배포 기준 구현으로 채택된 상태는 아님
