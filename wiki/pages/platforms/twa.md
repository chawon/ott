# TWA (Trusted Web Activity)

> Capacitor 기반 Android/iOS 앱, iOS TestFlight 배포까지 완료

## 관련 페이지
- [[pwa]]
- [[ms-store]]

---

## 현재 상태

**Capacitor 전환 완료, iOS TestFlight 테스트 배포 성공.**

- Android Play Store: 비공개 테스트 심사까지 완료, 테스터 모집 실패로 홀딩 중
  - Play Store 정식 출시 조건: 비공개 테스터 12명 이상, 14일 이상 유지
- iOS App Store: Apple Developer Program 연간 $99 가입 필요 — 검토 중 (TestFlight까지는 완료)

## 네이티브 앱 방향 고민 (2026-04-05)

Capacitor 래퍼 방식 대신 **React Native(Expo) 기반 네이티브 앱** 전환 검토 중.

- **스코프**: 타임라인 + 기록하기 딱 2개만, 심플하게
- **이유**: 웹 래퍼보다 네이티브 UX, App Store 심사 통과 가능성, 유입 경로 확보
- **유지보수**: Claude가 메인터너로 Expo + TypeScript 스택
- **미결정**: Capacitor 현행 유지 vs 네이티브 신규 개발 선택

---

## TWA 기준 정보 (구버전)

- 패키지명: `kr.pe.preview.ott.twa`
- 도메인: `https://ott.preview.pe.kr`
- 앱명: `On the Timeline (OTT)`

---

## Google Play 배포 현황

- 내부 테스트 트랙 배포 완료 (`track=internal`, `version=1.0.0`, `versionCode=4`)
- GitHub Actions `twa-release.yml` — AAB 빌드 → gplay 자동 배포
- `GPLAY_SERVICE_ACCOUNT_JSON` Secret 활성화

---

## 공유 인텐트 (MVP, 2026-02-15 완료)

Android `ACTION_SEND` 수신 → 웹앱에 `shared_text`, `shared_subject` 쿼리 전달 → QuickLog 검색창 자동 프리필

**지원 OTT 파서:**
- Netflix, Disney+, Prime Video, Apple TV, TVING, Coupang Play, WATCHA
- 파서 위치: `apps/web/lib/shareIntent.ts`
- URL 리졸버: `apps/web/app/share-resolve/route.ts` (allowlist 도메인만 HTML 메타 파싱)

---

## Android 홈 화면 위젯 (2026-02-18)

- `빠른 기록` 위젯 (1x2)
- 액션: `기록하기` → `/?quick=1&quick_focus=1`, `타임라인` → `/timeline`
- 위치: `apps/twa/app/src/main/java/kr/pe/preview/ott/twa/QuickLogWidgetProvider.java`

---

## Asset Links 설정

`apps/web/public/.well-known/assetlinks.json`에 release keystore SHA-256 fingerprint 등록 필요

현재 등록된 fingerprint:
- `FF:83:9F:7B:63:74:47:2D:D4:EF:5F:B4:4A:0E:6A:54:4F:5D:A9:A6:79:C5:FA:05:C0:6F:63:B8:E3:07:A3:36`
- `0E:25:31:CD:8B:18:6B:F3:5D:7C:10:13:7B:AC:FA:D0:97:42:52:A5:13:0E:43:E6:3C:5F:4B:04:88:66:56:66`

---

## Play 스토어 등록정보 초안 (구버전 기준)

- **앱 이름:** 온더타임라인 OTT
- **짧은 설명:** 영상과 독서 기록을 빠르게 남기고, 타임라인으로 되돌아보세요.
- **카테고리:** Lifestyle

---

## 빌드 방식

- WSL ARM Linux 환경에서 로컬 Android 빌드 비권장 (호환 문제)
- APK/AAB는 GitHub Actions에서 생성 후 아티팩트 다운로드

---

## Capacitor 전환 계획

```
앱 ID: app.ottline
앱명: ottline

apps/cap/                   ← Capacitor 프로젝트
capacitor.config.ts         ← webDir: ../web/out
```

- Android: `npx cap add android`
- iOS: `npx cap add ios`
- Apple Developer 계정 등록 필요 ($99/년)
