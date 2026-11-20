# ottline iOS 개발 및 배포

이 가이드는 현재 App Store 앱에 대응하는 `apps/native`의 Expo React Native 코드를 다룬다. 운영 빌드와 SwiftUI 전환 상태는 [iOS 플랫폼 Wiki](../../wiki/pages/platforms/native.md)에서 확인한다.

## 작업 경로

- 사용자 화면과 라우팅은 `app/`의 Expo Router, 로컬 기록·수정 이력·outbox는 [lib/localDb.ts](lib/localDb.ts)에 있다.
- [lib/api.ts](lib/api.ts)는 기본적으로 `https://ottline.app`을 사용한다. 개발 환경은 `EXPO_PUBLIC_API_BASE_URL`로 바꿀 수 있다. 기기 연결 정보는 SecureStore에 있고, [lib/sync.ts](lib/sync.ts)와 [lib/syncPayload.ts](lib/syncPayload.ts)가 `/api/sync/*`를 호출한다.
- 검색과 공개 글의 작품 변환은 [lib/titleAdapters.ts](lib/titleAdapters.ts)에서 관리한다. `KAKAO`와 `NAVER` 식별자를 모두 보존한다. [영어 도서 검색](../../docs/google-books-en-search.md)은 공개 앱에서 Kakao를 사용하며, `main`의 Expo 소스에는 영어 검색용 Google Books capability와 출처 표시가 들어 있다.
- iOS v2 SwiftUI 전환 작업은 [PR #137](https://github.com/chawon/ott/pull/137)의 `apps/ios-native`와 `apps/apple-core`에서 진행한다. PR에서 Expo SecureStore와 SQLite 이전, WidgetKit, 공유 확장 및 iPad 레이아웃을 함께 다룬다.

## 실행과 검증

저장소 루트에서 실행한다.

```bash
npm ci
npm run start --workspace native
npm run native:typecheck
npm run native:test
npm run native:testflight:check:structure
```

macOS에서 `npm run ios --workspace native`로 iOS 앱을 빌드하고 실행한다. [Native iOS CI](../../.github/workflows/native-ios-ci.yml)는 타입 검사, Jest, Expo Doctor, iOS 번들 export를 실행한다. 실제 서명과 TestFlight 설치 가능 여부는 EAS 및 App Store Connect에서 확인한다.

## Expo TestFlight 및 App Store

1. App Store Connect의 최신 처리 빌드 번호를 확인한다. `main`의 [app.json](app.json)에는 `ios.buildNumber=23`이 있고, 공개된 마지막 Expo 빌드는 `1.0.4 (24)`다. 다음 Expo 빌드는 `app.json`의 기준을 App Store Connect 최신 완료 빌드 이상으로 올려 [eas.json](eas.json)의 `autoIncrement`가 고유 번호를 만들게 한다.
2. `npm run native:testflight:check`, `npm run native:typecheck`, `npm run native:test`, `apps/native`에서 `npx expo-doctor`를 실행하고 PR CI를 확인한다.
3. [Native iOS TestFlight](../../.github/workflows/native-ios-testflight.yml)를 병합된 SHA로 수동 실행한다. EAS 제출을 다시 시도할 때는 성공한 빌드 ID를 재사용한다.
4. App Store Connect의 처리 결과와 TestFlight 설치를 확인한다. 실기기에서는 기존 앱 업데이트, 기기 연결, 영상·도서 기록 및 수정, 오프라인 동기화, 공유, 회고 알림과 탭 진입, 한국어·영어와 라이트·다크 조합을 확인한다.
5. App Review 제출 전 개인정보 라벨, 스크린샷, 리뷰어 접근, 계정 데이터 전체 삭제를 확인한다. 제출·공개 및 실제 스토어 업데이트 설치 결과를 각각 기록한다.

이전 제출 이력과 실기기 검증표는 [1.0 출시 체크리스트](../../docs/archive/ios/ios-app-store-launch-checklist.md), [TestFlight 제출 이력](../../docs/archive/ios/ios-testflight-review-notes.md), [Expo 초기 출시 계획](../../docs/archive/ios/ios-native-full-parity-testflight-plan.md)에 보관한다.
