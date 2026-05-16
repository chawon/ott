# ottline Native

React Native + Expo Router 기반 iOS 네이티브 앱 후보.

## 현재 범위

- v1 목표: TestFlight 준비
- iOS bundle identifier: `app.ottline`
- Android native package: `app.ottline.mobile` (현재 Android 배포 기준은 `apps/twa`)
- 화면: 기록, 타임라인, 계정, 문의함
- 데이터: `expo-sqlite` local-first 저장소 + outbox + `/api/sync/*`
- 인증: `expo-secure-store`에 `userId`, `deviceId`, `pairingCode` 저장

## 실행

```bash
npm install
npm run start --workspace native
npm run ios --workspace native
```

## 검증

```bash
npm run typecheck --workspace native
npm run test --workspace native -- --runInBand
```

## TestFlight 준비

Apple Developer Program과 App Store Connect 앱 등록은 아직 확인 전이다.
계정 준비 후 다음 순서로 진행한다.

1. App Store Connect에서 `app.ottline` 등록
2. EAS 프로젝트 연결
3. iOS signing credentials 생성
4. `eas build --platform ios --profile testflight`
5. TestFlight 내부 테스트

실제 App Store 제출 전에는 개인정보 라벨, 리뷰 계정/설명, 스크린샷, 계정 삭제 플로우 검증을 별도로 확인한다.
