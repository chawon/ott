# ottline Native

React Native + Expo Router 기반 iOS 네이티브 앱.

상위 실행 계획은 `docs/ios-native-full-parity-testflight-plan.md`를 기준으로 한다.

## 현재 범위

- 현재 목표: TestFlight build `1.0.0 (7)` 기준 iPhone 실기기 QA와 웹/Android parity 안정화를 진행한다.
- iOS bundle identifier: `app.ottline`
- Android production 경로는 계속 `apps/twa`다. 이 앱은 Android 배포 경로가 아니다.
- 구현 화면: 기록, 타임라인, 제목 상세/수정/history, 함께, 계정, 문의함, 내 리포트, 안내 화면
- 데이터: `expo-sqlite` local-first 저장소 + outbox + local history + `/api/sync/*`
- 인증: `expo-secure-store` 기반 `userId`, `deviceId`, `pairingCode`
- 알림: 명시적 opt-in 기반 locale-aware 주간/월간 회고 로컬 알림 + `/me/report` tap route
- UGC 운영: 공개 글/댓글 신고는 기존 문의함 작성 화면으로 대상 정보를 prefill해 접수한다.
- 2026-06-21 parity 보강: Web QuickLog와 같은 `영상/책` 2분류 검색, 상태 먼저 저장하는 QuickLog, 최근 함께 기록 기반 빈 검색 추천, 타임라인 카드 공유/함께 공개, 제목 상세 함께 진입, 설정 CSV 범위 내보내기, foreground sync를 실기기 QA 대상으로 추가했다.

## 아직 부족한 범위

- TestFlight build processing/available 상태를 App Store Connect TestFlight 탭에서 확인
- 내부 테스터가 TestFlight에서 build `1.0.0 (7)`을 설치할 수 있는지 확인
- 실제 iPhone에서 ko/en와 light/dark 조합 스크린 확인
- iOS 알림의 실제 iPhone/TestFlight 수신 및 tap route 검증
- locale/theme 기반은 `NativePreferencesProvider`와 `lib/i18n.ts`에 있다. 현재 탭 제목, 안내 화면, 기록하기, 타임라인, 제목 상세, 함께 목록, 공개 상세, 계정, 복구 카드, 문의함, 내 리포트, 리포트 공유 카드, 회고 알림, format helper, app shell dark theme까지 연결되어 있다. 계정 화면의 `system`/`light`/`dark` 수동 theme 설정은 SecureStore에 저장되며 analytics theme context에도 반영된다.

## 실행

```bash
npm install
npm run start --workspace native
npm run ios --workspace native
```

## 검증

```bash
npm run native:typecheck
npm run native:test
npm run native:testflight:check:structure
```

## TestFlight 준비

EAS project, App Store Connect 앱 레코드, iOS signing credentials, EAS Submit API key, GitHub `EXPO_TOKEN` 구성은 완료됐다.
현재 기준 최신 제출은 main SHA `667aafeb4546eb015a9ef7894f6cba9183db043e`, GitHub run `27805741470`, EAS build `7796ef11-75c1-4acb-95d7-96018e10bdbc`, App Store Connect build `1.0.0 (7)`이다.

새 TestFlight build가 필요하면 다음 순서로 진행한다.

1. iOS 수정은 `main`에서 `fix/native-*` 또는 `feature/native-*` 브랜치를 만들어 진행
2. `npm run native:testflight:check`, `npm run native:typecheck`, `npm run native:test`, `apps/native`의 `npx expo-doctor`, `git diff --check` 확인
3. PR CI 통과 후 `main`에 병합
4. GitHub Actions `Native iOS TestFlight` workflow를 병합된 main SHA로 수동 실행
5. App Store Connect TestFlight 탭에서 processing/available 확인
6. 내부 테스터 설치 후 `docs/ios-native-full-parity-testflight-plan.md`의 iPhone 실기기 확인표 수행

실제 App Store 제출 전에는 개인정보 라벨, 리뷰 계정/설명, 스크린샷, 계정 삭제 플로우 검증을 별도로 확인한다.
App Store Connect 입력 초안과 reviewer 접근 설명은 `docs/ios-testflight-review-notes.md`에서 관리한다.
