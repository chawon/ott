# macOS 네이티브 v2

기준일 2026-11-21. macOS 14 이상을 대상으로 하는 SwiftUI 네이티브 앱이다. [apps/macos-native](../../../apps/macos-native/)에서 1280px 데스크톱 레이아웃(홈·타임라인·2단 함께·2컬럼 작품 상세·내 서가·웹 기준 가이드/소개/FAQ/개인정보/문의함)·인트로 스플래시·상단 메뉴 막대 빠른 기록·Spotlight 검색·온디바이스 즉시 공유 카드를 구현하고, iOS v2와 함께 [apps/apple-core](../../../apps/apple-core/)의 SQLite 저장·Outbox 동기화·2단계 포스터 캐시·미래의 타임라인 복구(`#142`)를 사용한다.

## 개발·배포 상태

- [PR #137](https://github.com/chawon/ott/pull/137)이 `main`(`d0844fc`, 코드 `2634fdc`)에 병합됐다.
- **App Sandbox**(`com.apple.security.app-sandbox`, `network.client`, `files.user-selected.read-write`) 활성화 및 Release 권한 검증, `OttlineMacTests` 5/5 통과, [macOS SwiftUI CI](https://github.com/chawon/ott/actions/runs/44897582916) 통과, 맥 실기기 UI·기능 검수를 마쳤다.
- App Store Connect `ottline`(`app.ottline`, Apple ID `6780318110`)에 **macOS 플랫폼**을 추가하고, Release 빌드 **`2.0.0 (27)`** 및 한·영 `2560×1600` 스크린샷 각 5장·심사 메모를 입력해 **최초 Mac App Store 심사 제출**을 완료했다(승인·공개 게시 대기).

## Web/API 연결과 출시 확인

- `ottline://quick` 빠른 기록 별칭과 `?native_handoff=1` → `ottline://open?handoff=1` 브라우저 세션 병합을 구현했다. 공개 스토어 설치판에서 Safari·Chrome 기록 이어받기와 빈 세션·로컬 미동기화 기록 처리를 최종 확인한다.
- 앱은 `X-Client-Platform: macos_native`를 전송하며 운영 API는 이 값을 지원한다(`macOS App · macOS`). [API/Web 반영 기록](../../../docs/desktop-acquisition-rollout-2026-11-18.md)
- Mac App Store 게시 승인 및 URL을 확인한 뒤 웹과 [브라우저 확장 진입](browser-extension.md)의 macOS 분기를 활성화한다. [공통 프로토콜·핸드오프](../../../docs/desktop-protocol-and-extension-bridge-plan-2026-11-18.md) · [v2 후속 작업](../../../docs/changes/v2-follow-up.md#2-apple-v2-업데이트-검증)
