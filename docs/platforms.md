# 플랫폼별 소스와 출시 현황

Web/PWA 운영 버전은 `8c8b064`, 공통 API 운영 버전은 `1dc6825`다. 11월 25일 한국·미국 스토어에서 Windows `2.0.2.0`과 Android `2.0.5`를 확인했다. Apple의 `2.0.1`은 11월 24일 공개됐다. [Web 배포](https://github.com/chawon/ott/actions/runs/45615659458) · [API 배포·검증](changes/api-sync-delivery-171-2026-11-25.md) · [Microsoft Store](../wiki/pages/platforms/ms-store.md) · [Google Play](../wiki/pages/platforms/android-native.md)

| 대상 | 구현 소스 | 출시·개발 상태 | 기록 |
| --- | --- | --- | --- |
| 공통 API | [apps/api](../apps/api) | 운영 `1dc6825`. 페어링된 기기가 이전 동기화에서 놓친 과거 기록을 받아 온다. 큐레이터 공개 `200 []`·관리자 쓰기 `410`과 자동화 종료, iPad·Android 태블릿 기기 표기를 포함한다. 기존 #144의 추천·기기 계약을 유지하며 실제 API·보관 자료·합성 UA 13개 시나리오/기존 ID 보존을 확인했다. | [#171 운영 검증](changes/api-sync-delivery-171-2026-11-25.md) · [11월 22일 통합 배포](web-api-rollout-2026-11-22.md) · [API/데이터 계약](product-contracts.md) · [운영 설정](../deploy/oke/api-deployment.yaml) |
| Web/PWA | [apps/web](../apps/web) | 운영 `8c8b064`. 여러 기기의 수정이 겹쳐 오래된 수정이 거절되면 최신 기록을 확인한 후 다음 기록을 전송한다. iPhone·iPad·Mac 방문자에게 기기에 맞는 App Store를 안내한다. | [운영 배포](https://github.com/chawon/ott/actions/runs/45615659458) · [동기화 인수 #162](https://github.com/chawon/ott/issues/162#issuecomment-7162996402) · [스토어 안내 #175](https://github.com/chawon/ott/issues/175) · [PWA](../wiki/pages/platforms/pwa.md) |
| Android | [apps/android-native](../apps/android-native) | 한국·미국 Google Play 공개판 `2.0.5 (29)`. 웹 기록 이어받기의 실패·재시도를 고친 PR #154를 `392d0b7`에 병합하고 `2.0.6 (30)` 서명 후보를 검증했다. Play 반영과 설치판의 Chrome 복귀 확인은 Android 담당이 추적한다. | [Android Wiki](../wiki/pages/platforms/android-native.md) · [2.0.5 공개판 빌드](https://github.com/chawon/ott/actions/runs/44981269777) · [2.0.6 후보 빌드](https://github.com/chawon/ott/actions/runs/45750274521) · [인수와 후속](https://github.com/chawon/ott/issues/149#issuecomment-7182015348) |
| iOS·iPadOS | [apps/ios-native](../apps/ios-native) · [apps/apple-core](../apps/apple-core) | SwiftUI `2.0.1` 공개(11월 24일, iOS/iPadOS 16 이상). 계정 삭제 실패 처리와 큐레이터 제거, iPad 함께 2단의 선택 유지·오류 안내를 반영했다. [PR #173](https://github.com/chawon/ott/pull/173) · [병합본 iOS CI 20/20](https://github.com/chawon/ott/actions/runs/45190943521) | [iOS·iPadOS Wiki](../wiki/pages/platforms/native.md) · [App Store](https://apps.apple.com/app/id6780318110) · [출시 후 검증](changes/v2-follow-up.md#2-apple-v2-업데이트-검증) |
| Windows | [apps/windows-native](../apps/windows-native) | Microsoft Store 공개 `2.0.2.0`(x64·arm64). 기록 삭제와 편집이 겹칠 때 새 감상·기존 이력을 보존하는 `2.0.3.0`은 `main` `7154328` 병합·CI 통과 후 11월 26일 Partner Center 심사 제출(`1152921505702511198`, `Certification`, `Errors: 0`)을 마쳤다. | [공개 패키지·제출](../wiki/pages/platforms/ms-store.md) · [main CI](https://github.com/chawon/ott/actions/runs/45615633182) · [Partner Center 확인과 설치판 검증](https://github.com/chawon/ott/issues/161#issuecomment-7181905935) |
| macOS | [apps/macos-native](../apps/macos-native) · [apps/apple-core](../apps/apple-core) | SwiftUI `2.0.1` 공개(11월 24일, macOS 14 이상, App Sandbox). 데스크톱·알림 센터 위젯 3종, 함께 목록의 필터·정렬, 큐레이터 제거와 계정 삭제 실패 처리를 반영했다. [PR #173](https://github.com/chawon/ott/pull/173) · [병합본 macOS CI 6/6](https://github.com/chawon/ott/actions/runs/45190943508) | [macOS Wiki](../wiki/pages/platforms/macos-native.md) · [Mac App Store](https://apps.apple.com/app/id6780318110?platform=mac) · [출시 후 검증](changes/v2-follow-up.md#2-apple-v2-업데이트-검증) |
| Chrome·Edge·Whale | [apps/browser-extension](../apps/browser-extension) | Chrome 공개 버전은 `0.1.0`, 저장소 manifest는 `0.1.1`이다. Edge·Whale의 최신 게시 버전은 확인 대상이다. Windows 빠른 기록 선택은 기존 확장이 여는 웹에서 제공한다. | [확장 Wiki](../wiki/pages/platforms/browser-extension.md) · [데스크톱 연결](desktop-protocol-and-extension-bridge-plan-2026-11-18.md) |
| 토스 인앱 | [토스 출시 브랜치](https://github.com/chawon/ott/tree/chore/toss-inapp-current-release-20260517)의 `apps/web` | `내 OTT 타임라인` 승인·출시 기록이 있다. 별도 빌드의 공개판을 유지하고 검색·기록·타임라인을 우선 검증한다. | [토스 인앱 Wiki](../wiki/pages/platforms/toss-inapp.md) |

11월 25일 Web과 API의 운영 이미지·`APP_VERSION`이 각각 `8c8b064`와 `1dc6825`로 일치했다. 두 Pod는 각 1/1 Ready, 재시작 0회였고 Argo CD는 `Synced / Healthy`였다. [Web 배포 설정](https://github.com/chawon/ott/commit/122b770d200e958cfa125ab3a1066a2413f0c16f) · [공개 Web 버전](https://ottline.app/.well-known/ottline-version)

한국·미국 App Store의 `2.0.1` 버전 기록 시각은 11월 24일 Mac 06:09 KST, iPhone·iPad 08:25 KST다. 제출 빌드 `28`은 Apple 담당의 11월 23일 제출 기록에서 확인했다. 최초 SwiftUI `2.0.0 (27)`은 11월 22일 출시됐다. [한국 Mac](https://apps.apple.com/kr/app/id6780318110?platform=mac) · [미국 Mac](https://apps.apple.com/us/app/id6780318110?platform=mac) · [iPhone](https://apps.apple.com/kr/app/id6780318110) · [iPad](https://apps.apple.com/us/app/id6780318110?platform=ipad) · [빌드 제출](https://github.com/chawon/ott/issues/163#issuecomment-7103943427) · [공개 후 실기기 검증](https://github.com/chawon/ott/issues/163#issuecomment-7119018051)

공개 서비스 소개·가이드의 macOS·iPhone·iPad 안내와 미운영 ChatGPT 노출 제외는 Web `c693fd8`로 배포했다. [Web/PWA 담당 업무](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827749)의 Safari/Chrome·Mac 설치판/PWA 확인은 별도로 추적한다.

11월 23일 당시 Windows 공개 `2.0.1.0` 설치판(`ChawonLee.ottline_2.0.1.0_arm64__ry7416pek43sa`)에서 서버 계정 삭제 성공 시 로컬 초기화와 오프라인 실패 시 기록·연결 상태 보존을 2026-11-23 실기기 검증으로 완료했다. [삭제 정책과 Windows 검증](../wiki/pages/features/delete-sync.md#windows-확인-사항)

Windows 담당은 11월 26일 `2.0.3.0`(Submission `1152921505702511198`, `Certification`)을 스토어에 제출했으며, 공개 게시 후 기존 설치판을 업데이트해 Windows·모바일·웹에서 최신 감상과 기존 이력이 보존되는지 확인한다. [후속 #161](https://github.com/chawon/ott/issues/161#issuecomment-7162883131)

## 이전 설치와 연결 채널

- Android Bubblewrap TWA는 `1.0.19 (23)`까지의 배포 계열이다. 현재 Android 앱은 같은 Play 패키지를 이어받는다. 기존 설치 토큰으로 세션을 복구하거나, 호환 브라우저의 웹 세션과 로컬 기록을 핸드오프로 이어받는 경로를 유지한다. [Android 전환](android-native-v2-transition.md)
- Windows의 이전 Microsoft Store PWABuilder 패키지는 동일 스토어 제품의 네이티브 MSIX로 전환됐다. 브라우저/PWA의 계정과 기록 복구, `ottline://` 연결은 [데스크톱 계약](desktop-protocol-and-extension-bridge-plan-2026-11-18.md)을 따른다.
- iPhone·iPad는 같은 App Store 앱의 Expo `1.0.4 (24)`에서 SwiftUI v2로 전환됐다. 이전 [apps/native](../apps/native)와 [Expo 개발·배포 기록](../apps/native/DEVELOPMENT.md)은 데이터 이전·업데이트 검증을 위해 보존한다.
- ChatGPT 커넥터는 공개 서비스 미운영 상태다. 읽기 전용 [연결 계약](product-contracts.md#chatgpt-app)으로 실제 연결과 제출 자료를 다시 검증한다.

[브라우저 확장·토스 인앱·ChatGPT 앱 개편 방향](changes/v2-channel-strategy.md)에 각 채널의 다음 작업과 출시 판단 기준을 기록한다.
