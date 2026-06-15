# ottline Native

React Native + Expo Router 기반 iOS 네이티브 앱.

상위 실행 계획은 `docs/ios-native-full-parity-testflight-plan.md`를 기준으로 한다.

## 현재 범위

- 현재 목표: `docs/ios-native-full-parity-testflight-plan.md` 기준으로 iOS native full parity와 TestFlight 제출 경로를 준비한다.
- iOS bundle identifier: `app.ottline`
- Android production 경로는 계속 `apps/twa`다. 이 앱은 Android 배포 경로가 아니다.
- 구현 화면: 기록, 타임라인, 제목 상세/수정/history, 함께, 계정, 문의함, 내 리포트, 안내 화면
- 데이터: `expo-sqlite` local-first 저장소 + outbox + local history + `/api/sync/*`
- 인증: `expo-secure-store` 기반 `userId`, `deviceId`, `pairingCode`
- 알림: 명시적 opt-in 기반 locale-aware 주간/월간 회고 로컬 알림 + `/me/report` tap route
- UGC 운영: 공개 글/댓글 신고는 기존 문의함 작성 화면으로 대상 정보를 prefill해 접수한다.

## 아직 부족한 범위

- 실제 iPhone에서 ko/en와 light/dark 조합 스크린 확인
- iOS 알림의 실제 iPhone/TestFlight 수신 및 tap route 검증
- App Store Connect `ascAppId`, iOS signing credentials, App Store Connect API key 준비
- TestFlight workflow는 추가됐지만, Apple Developer Program 활성화, App Store Connect 앱 생성, `ascAppId`, EAS credentials 준비 전에는 build 단계로 진행하지 않는다.
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

EAS project는 생성/연결됐고 `app.json`에 `expo.extra.eas.projectId`가 반영됐다.
Apple Developer Program과 App Store Connect 앱 등록은 아직 진행 중이다.
계정 준비 후 다음 순서로 진행한다.

1. App Store Connect에서 `app.ottline` 등록
2. App Store Connect의 App Information에서 Apple ID 숫자(`ascAppId`) 확인
3. EAS credentials에 iOS signing credentials와 App Store Connect API key 구성
4. `apps/native/eas.json`의 `submit.testflight.ios.ascAppId` placeholder를 실제 App Store Connect Apple ID로 교체
5. `npm run native:testflight:check`로 TestFlight config를 확인
6. GitHub Actions에서 native iOS TestFlight workflow 실행
7. TestFlight 내부 테스트

실제 App Store 제출 전에는 개인정보 라벨, 리뷰 계정/설명, 스크린샷, 계정 삭제 플로우 검증을 별도로 확인한다.
App Store Connect 입력 초안과 reviewer 접근 설명은 `docs/ios-testflight-review-notes.md`에서 관리한다.
