# iOS·iPadOS 네이티브 v2

2026년 11월 24일 기준 iPhone·iPad의 App Store 공개 버전은 SwiftUI `2.0.1`이다. 기존 Expo `1.0.4 (24)`에서 공개 앱으로 업데이트할 때의 계정·기록·미동기화 변경 보존은 Apple 담당이 확인한다. [업데이트 검증](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312000240)

## 운영 앱

| 항목 | 확인 내용 |
| --- | --- |
| App Store | 공개 버전 `2.0.1`, 제출 빌드 `28`. [iPhone](https://apps.apple.com/kr/app/id6780318110) · [iPad](https://apps.apple.com/kr/app/id6780318110?platform=ipad) · [빌드 제출](https://github.com/chawon/ott/issues/163#issuecomment-7103943427) |
| 소스 | [apps/ios-native](../../../apps/ios-native/)와 공용 [apps/apple-core](../../../apps/apple-core/) |
| 앱 식별자 | Bundle ID `app.ottline`, Apple ID `6780318110` |
| 기술·지원 OS | SwiftUI, SwiftPM 공용 코어, SQLite·Outbox 동기화. iOS/iPadOS `16.0+` |
| 검증·배포 | [SwiftUI iOS CI](../../../.github/workflows/native-ios-v2-ci.yml), [서명·TestFlight 워크플로우](../../../.github/workflows/native-ios-v2-release.yml), App Store Connect |
| 개발 시작 | [SwiftUI 개발 및 배포 가이드](../../../apps/ios-native/DEVELOPMENT.md) |

한국·미국 iPhone·iPad 스토어의 `2.0.1` 버전 기록은 `2026-11-24 08:25 KST`다. [한국 iPhone](https://apps.apple.com/kr/app/id6780318110) · [미국 iPad](https://apps.apple.com/us/app/id6780318110?platform=ipad) · [macOS 버전 기록](macos-native.md)

## SwiftUI v2 전환과 검증 근거

- [PR #137](https://github.com/chawon/ott/pull/137)(`main` `d0844fc`, 코드 `2634fdc`)으로 iOS·macOS·공통 SwiftPM 패키지가 main에 통합됐다.
- Expo SecureStore·SQLite 이전, WidgetKit, 공유 확장, Siri 단축어, Handoff, iPad 2컬럼 레이아웃, 2단계 포스터 캐시, 온디바이스 공유 카드 생성, 미래의 타임라인 복구(`#142`), `ObservableObject` 메인 스레드 발행 안전화를 구현했다.
- `2026-11-21` `OttlineTests` 18/18·[iOS SwiftUI CI](https://github.com/chawon/ott/actions/runs/44897582945) 통과 및 실기기(iPhone X `iOS 16.7.16`, iPad 10세대) 검증을 마쳤다. Release `2.0.0 (27)`(`OttlineWidgetExtension`·`OttlineShareExtension` 포함)과 한·영 스크린샷을 App Store Connect에 제출했다.
- `2026-11-22` 사용자 출시 확인을 반영했다. 공개 스토어판의 기존 Expo 인플레이스 업데이트 시 계정·기록·미동기화 변경 보존은 [출시 후 검증](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312000240)에서 확인한다.
- `2026-11-23` **`2.0.1 (28)`**([PR #173](https://github.com/chawon/ott/pull/173), `main` `5567dd5`, 코드 `49e62c3`)을 병합해 서버 계정 삭제 오류 보존([#163](https://github.com/chawon/ott/issues/163))·함께 AI 큐레이터 제거·iPad 함께 2단 정합성(가로/세로/Split View 선택 연속성·직접 링크·오류/재시도·반응 레이스 가드)을 반영했다. `OttlineTests` 20/20·[PR iOS CI `45183376281`](https://github.com/chawon/ott/actions/runs/45183376281) 통과 후 Release **`2.0.1 (28)`**을 App Store Connect에 **심사 제출 완료**했다(당시 `Waiting for Review`).
- `2026-11-24` 공개를 확인했다. 병합본 iOS 테스트 20개가 통과했다. 공개 설치판의 삭제 실패·성공, 큐레이터 제거와 iPad 창 너비 전환을 확인한다. [병합본 CI](https://github.com/chawon/ott/actions/runs/45190943521) · [삭제 검증 #163](https://github.com/chawon/ott/issues/163#issuecomment-7119018051) · [담당 업무와 완료 조건](../../../docs/changes/v2-follow-up.md#2-apple-v2-업데이트-검증)

## 이전 Expo 설치판

[apps/native](../../../apps/native/)는 이전 Expo React Native 앱의 소스다. `1.0.4 (24)`의 EAS 제출 기록과 데이터 이전 근거를 보존한다. 현재 SwiftUI 앱의 빌드·배포 시작점은 위 가이드를 따른다.

- [Expo 개발·배포 가이드](../../../apps/native/DEVELOPMENT.md) · [EAS 빌드 24](https://expo.dev/accounts/ergate23/projects/ottline/builds/057972ad-3c10-4a59-9e5b-ef051c1a160d)
- [카카오 도서 검색 및 iOS 1.0.4 배포 기록](../../../docs/native-kakao-books.md) · [영어 도서 검색의 기존 앱 호환](../../../docs/google-books-en-search.md)
- [1.0 출시 체크리스트](../../../docs/archive/ios/ios-app-store-launch-checklist.md) · [초기 Expo TestFlight 제출 이력](../../../docs/archive/ios/ios-testflight-review-notes.md)

## 관련 플랫폼

- [macOS 네이티브](macos-native.md)
- [Android 네이티브](android-native.md)
