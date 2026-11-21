# iOS 앱

기준일 2026-11-21. App Store 공개판은 Expo 기반 `1.0.4 (24)`이며, SwiftUI 네이티브 v2 `2.0.0 (26)`이 App Store 심사에 제출된 상태다.

## 운영 앱

| 항목 | 확인 내용 |
|---|---|
| App Store | `1.0.4` build `24`. 공개 버전은 Apple 한국 스토어 조회, 빌드 번호는 제출 이력으로 확인 |
| 소스 | `main`의 [apps/native](../../../apps/native/) |
| 앱 식별자 | Bundle ID `app.ottline`, Apple ID `6780318110` |
| 기술 | Expo SDK 55, React Native `0.83.10`, Expo Router, SQLite, SecureStore |
| 배포 | [Native iOS CI](../../../.github/workflows/native-ios-ci.yml), [Native iOS TestFlight](../../../.github/workflows/native-ios-testflight.yml), EAS, App Store Connect |
| 도서 검색 | 공개 앱은 Kakao 검색과 이전 Naver 기록의 호환을 유지한다. `main` 소스의 Google Books capability는 다음에 해당 코드를 포함한 빌드에서 적용된다 |

공개 버전과 빌드 근거는 [App Store](https://apps.apple.com/kr/app/ottline/id6780318110), [Apple 공개 조회](https://itunes.apple.com/lookup?id=6780318110&country=kr), [EAS 빌드 24](https://expo.dev/accounts/ergate23/projects/ottline/builds/057972ad-3c10-4a59-9e5b-ef051c1a160d)에서 확인할 수 있다. 실제 업데이트 설치 후 기록·수정과 운영 지표 확인은 [1.0 출시 체크리스트](../../../docs/archive/ios/ios-app-store-launch-checklist.md)에 남아 있다.

실행, 검증, 다음 EAS 빌드 번호 관리는 [iOS 개발 및 배포 가이드](../../../apps/native/DEVELOPMENT.md)를 따른다.

## SwiftUI v2 전환

- [PR #137](https://github.com/chawon/ott/pull/137)의 `feature/ios-native-v2` 브랜치가 iOS `apps/ios-native`(`iOS 16.0+`), macOS `apps/macos-native`, 공통 SwiftPM 패키지 `apps/apple-core`를 함께 추가한다.
- iOS v2에서 Expo SecureStore·SQLite 이전, WidgetKit, 공유 확장, Siri 단축어, Handoff, iPad 2컬럼 레이아웃, 2단계 포스터 캐시, 온디바이스 공유 카드 생성, 미래의 타임라인 복구(`#142`)를 구현했다.
- `2026-11-21` 커밋 `f8fa77d` 기준으로 실기기(iPhone X `iOS 16.7.16`, iPad 10세대) 검증을 마치고, Release 빌드 **`2.0.0 (26)`**(`OttlineWidgetExtension`·`OttlineShareExtension` 포함)을 App Store Connect에 업로드해 한·영 스크린샷과 함께 **App Store 심사 제출**을 완료했다.
- App Store `2.0.0 (26)` 심사 승인·공개 게시, 공개 스토어판 기준 기존 Expo `1.0.4` 업데이트 실사용 확인, PR #137 병합이 남아 있다. [v2 후속 작업](../../../docs/changes/v2-follow-up.md#2-apple-v2-업데이트-검증)

## 관련 문서

- [카카오 도서 검색 및 iOS 1.0.4 배포 기록](../../../docs/native-kakao-books.md)
- [영어 도서 검색](../../../docs/google-books-en-search.md)
- [초기 Expo TestFlight 제출 이력](../../../docs/archive/ios/ios-testflight-review-notes.md)
- [Android 네이티브](android-native.md)
