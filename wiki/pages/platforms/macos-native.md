# macOS 네이티브 v2

2026년 11월 24일 기준 공개 버전은 `2.0.1`이다. macOS 14 이상에서 설치할 수 있다. [Mac App Store](https://apps.apple.com/kr/app/id6780318110?platform=mac)

[apps/macos-native](../../../apps/macos-native/)에서 1280px 데스크톱 레이아웃(홈·타임라인·2단 함께·2컬럼 작품 상세·내 서가·웹 기준 가이드/소개/FAQ/개인정보/문의함)·인트로 스플래시·상단 메뉴 막대 빠른 기록·Spotlight 검색·온디바이스 즉시 공유 카드를 구현하고, iOS v2와 함께 [apps/apple-core](../../../apps/apple-core/)의 SQLite 저장·Outbox 동기화·2단계 포스터 캐시·미래의 타임라인 복구(`#142`)를 사용한다.

## 개발·배포 상태

- [PR #137](https://github.com/chawon/ott/pull/137)이 `main`(`d0844fc`, 코드 `2634fdc`)에 병합됐다.
- **App Sandbox**(`com.apple.security.app-sandbox`, `network.client`, `files.user-selected.read-write`) 활성화 및 Release 권한 검증, `OttlineMacTests` 5/5 통과, [macOS SwiftUI CI](https://github.com/chawon/ott/actions/runs/44897582916) 통과, 맥 실기기 UI·기능 검수를 마쳤다.
- `2026-11-21` App Store Connect `ottline`(`app.ottline`, Apple ID `6780318110`)에 **macOS 플랫폼**을 추가하고, Release 빌드 **`2.0.0 (27)`** 및 한·영 `2560×1600` 스크린샷 각 5장·심사 메모를 입력해 최초 심사 제출을 완료했다.
- `2026-11-22` 사용자가 macOS·iOS·iPadOS 출시 완료를 확인했다. [출시 완료 카드](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827691). Apple ID 기반 iOS 공개 조회는 Mac 빌드 번호의 검증 근거로 사용하지 않는다.
- `2026-11-23` **`2.0.1 (28)`**([PR #173](https://github.com/chawon/ott/pull/173), `main` `5567dd5`, 코드 `49e62c3`)을 병합해 서버 계정 삭제 오류 보존([#163](https://github.com/chawon/ott/issues/163))·함께 AI 큐레이터 제거·함께 종류 필터/정렬/반응 레이스 가드/오류 재시도·**데스크톱 위젯(`OttlineMacWidgetExtension`, `app.ottline.MacWidget`, App Group `3Z9ULN66D4.group.app.ottline`, Small/Medium/Large)**을 구현했다. `OttlineMacTests` 6/6·[main macOS CI `45190943508`](https://github.com/chawon/ott/actions/runs/45190943508)·`macOS 15.8.3` 데스크톱 위젯 실기기 확인을 마치고 Release **`2.0.1 (28)`**을 App Store Connect에 **심사 제출 완료**했다(`Waiting for Review`).
- `2026-11-24` 한국·미국 Mac App Store의 버전 기록에서 `2.0.1`(06:09 KST)을 확인했다. 데스크톱·알림 센터의 작은·중간·큰 위젯은 제출 전 macOS 15.8.3 서명 Release에서 등록·렌더링을 확인했다. [한국 Mac](https://apps.apple.com/kr/app/id6780318110?platform=mac) · [미국 Mac](https://apps.apple.com/us/app/id6780318110?platform=mac) · [담당 검증](https://github.com/chawon/ott/issues/163#issuecomment-7103719535)
- 개발 시작점은 [macOS 개발 가이드](../../../apps/macos-native/DEVELOPMENT.md)다.

## Web/API 연결과 출시 확인

- macOS 15.8.3의 `2.0.0 (27)` Mac App Store 설치판에서 영수증·서명·App Sandbox, `ottline://quick`을 통한 실행을 확인했다. macOS 담당은 공개 `2.0.1` 설치판에서 Safari·Chrome의 기존 계정·기록을 이어받고 빠른 기록 화면의 제목·플랫폼 값이 채워지는지 확인한다. [Mac 설치판 검증](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827720)
- 앱은 `X-Client-Platform: macos_native`를 전송하며 운영 API는 이 값을 지원한다(`macOS App · macOS`). [API/Web 반영 기록](../../../docs/desktop-acquisition-rollout-2026-11-18.md)
- `2.0.1`에서 계정 삭제 실패 시 기록과 연결을 보존하고 재시도를 안내한다. 공개 설치판의 실패·성공 확인은 Apple 공통 담당이 맡는다. Web의 한국어·영어 서비스 소개·가이드에는 macOS가 반영됐다. 설치판 브라우저 연결 결과는 Web/PWA·확장 담당과 공유한다. [삭제 검증 #163](https://github.com/chawon/ott/issues/163#issuecomment-7119018051) · [Web 반영 기록](../../../docs/web-api-rollout-2026-11-22.md) · [확장 진입](browser-extension.md)
- [공통 프로토콜·핸드오프](../../../docs/desktop-protocol-and-extension-bridge-plan-2026-11-18.md) · [v2 후속 작업](../../../docs/changes/v2-follow-up.md#2-apple-v2-업데이트-검증)
