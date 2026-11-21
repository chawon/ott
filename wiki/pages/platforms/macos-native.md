# macOS 네이티브 v2

macOS 14 이상을 대상으로 하는 SwiftUI 앱이다. `apps/macos-native`에서 홈·빠른 기록·메뉴 막대·공유 카드를 구현하고, iOS v2와 함께 [`apps/apple-core`](https://github.com/chawon/ott/tree/4addda326cab650509a35f1acbbbeb51aa7cdc5c/apps/apple-core)의 SQLite 저장 및 Outbox 동기화를 사용한다.

## 개발·배포 상태

- [PR #137](https://github.com/chawon/ott/pull/137)은 열려 있다. 개발 코드는 [`feature/ios-native-v2`의 `apps/macos-native`](https://github.com/chawon/ott/tree/4addda326cab650509a35f1acbbbeb51aa7cdc5c/apps/macos-native)에 있으며, 확인한 브랜치 SHA는 `4addda3`이다.
- [macOS CI](https://github.com/chawon/ott/actions/runs/44558347464)에서 XcodeGen 프로젝트 생성 및 서명 없는 빌드·XCTest가 통과했다. 최초 Mac App Store 제출, 심사, 게시 상태는 확인되지 않았다.

## Web/API 연결과 출시 확인

- `8685ff2`에 `ottline://quick` 빠른 기록 별칭과 `?native_handoff=1` → `ottline://open?handoff=1` 브라우저 세션 병합을 구현했다. Safari와 Chrome에서 실제 기록이 이어지고 빈 세션과 로컬 미동기화 기록을 처리하는지 확인한다. [구현 커밋](https://github.com/chawon/ott/commit/8685ff241f7420d7032731e8ac413ce2fd12d460)
- 개발 앱은 `X-Client-Platform: macos_native`를 전송하며 운영 API는 이 값을 지원한다. 출시 전 실기기에서 연결 기기 목록의 `macOS App · macOS` 표시를 확인한다. [API/Web 반영 기록](../../../docs/desktop-acquisition-rollout-2026-11-18.md)
- Mac App Store 게시 URL을 확인한 뒤 웹과 [브라우저 확장 진입](browser-extension.md)의 macOS 분기를 활성화한다. [공통 프로토콜·핸드오프](../../../docs/desktop-protocol-and-extension-bridge-plan-2026-11-18.md)
