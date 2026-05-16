# iOS Native TestFlight Plan

## 목표

`apps/native`를 Expo 기반 iOS 네이티브 앱으로 준비한다. 이번 단계의 완료 기준은 App Store 제출이 아니라 TestFlight 빌드 제출이 가능한 코드와 설정을 갖추는 것이다.

## 현재 결정

- 프레임워크: React Native + Expo Router
- iOS Bundle Identifier: `app.ottline`
- Android native package: `app.ottline.mobile` (현재 Android 배포 기준은 `apps/twa`)
- v1 범위: 기록 핵심
  - 검색 후 QuickLog 저장
  - local-first 타임라인
  - 페어링 코드 기반 계정 연결
  - 문의함
  - 로컬 초기화와 서버 데이터 전체 삭제
- 제외: DNA Aura/Journey 실험 화면, 추천 기능, WebView/Capacitor 래퍼

## 구현 기준

- 로컬 저장소는 `expo-sqlite`를 사용한다.
- 쓰기 흐름은 웹과 동일하게 로컬 반영 후 outbox에 적재하고 `/api/sync/push`로 전송한다.
- 서버 pull은 `/api/sync/pull?since=`와 `lastSyncAt` 체크포인트를 사용한다.
- 인증 정보는 `expo-secure-store`에 저장한다.
- 계정이 없는 상태에서도 로컬 기록을 먼저 만들 수 있고, 동기화 시 `POST /api/auth/register`로 계정을 발급한다.

## 남은 제출 준비

1. Apple Developer Program 상태 확인
2. App Store Connect 앱 등록
3. EAS 프로젝트 연결 및 signing credential 생성
4. `eas build --platform ios --profile testflight` 실행
5. TestFlight 내부 테스트
6. App Privacy 라벨, 스크린샷, 리뷰 노트 작성

## 검증

```bash
npm run typecheck --workspace native
npm run test --workspace native -- --runInBand
```
