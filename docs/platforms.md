# 플랫폼별 소스와 출시 현황

기준 소스는 [main `3920e30`](https://github.com/chawon/ott/commit/3920e3025ec89807b645416213812950d8abc86c)이다. Apple v2처럼 main 밖에서 진행하는 작업은 PR을 연결한다. 버전은 확인한 운영 이미지 또는 게시·배포 기록을 적는다.

| 대상 | 구현 소스 | 출시·개발 상태 | 기록 |
| --- | --- | --- | --- |
| 공통 API | [apps/api](../apps/api) | 운영 `38112ca`. Android·Windows·macOS·iOS의 연결 기기 표기를 지원한다. | [API/데이터 계약](product-contracts.md) · [운영 설정](../deploy/oke/api-deployment.yaml) |
| Web/PWA | [apps/web](../apps/web) | 운영 `4472ad3`, v2 Web/PWA 및 확장 → Windows 빠른 기록 링크 포함. 브라우저 설치형 PWA를 제공한다. | [PWA](../wiki/pages/platforms/pwa.md) · [Web 개편 배포](ottline-v2-production-rollout.md) · [운영 설정](../deploy/oke/web-deployment.yaml) |
| Android | [apps/android-native](../apps/android-native) | Google Play `app.ottline`, Kotlin/Compose 기반. 배포 워크플로우에서 확인한 버전은 `2.0.4 (28)`. 운영 API는 기존 앱의 User-Agent로 기기를 구분한다. main의 전용 플랫폼 헤더는 다음 바이너리 변경에 해당한다. | [Android Wiki](../wiki/pages/platforms/android-native.md) · [Play 배포 run](https://github.com/chawon/ott/actions/runs/44111552653) · [전환과 복구](android-native-v2-transition.md) |
| iOS | [apps/native](../apps/native) | App Store 공개 Expo React Native `1.0.4 (24)`. SwiftUI v2 `apps/ios-native` 및 공용 `apps/apple-core`는 PR #137에서 개발 중이다. | [iOS Wiki](../wiki/pages/platforms/native.md) · [App Store](https://apps.apple.com/app/ottline/id6780318110) · [Apple PR #137](https://github.com/chawon/ott/pull/137) |
| Windows | [apps/windows-native](../apps/windows-native) | Microsoft Store `2.0.0.0` 게시. 기존 스토어 PWA의 앱 항목과 업데이트 경로를 승계했고, 앱 설치와 기존 PWA에서 계정·기록 이어받기를 테스트했다. | [Windows Wiki](../wiki/pages/platforms/windows-native.md) · [스토어 전환 기록](windows-native-v2-transition.md) |
| macOS | PR #137의 `apps/macos-native`, `apps/apple-core` | SwiftUI 앱 개발 중. PR의 macOS CI 통과를 확인했다. Mac App Store 출시와 갱신 경로는 확인 전이며 Web/PWA도 이용할 수 있다. | [macOS Wiki](../wiki/pages/platforms/macos-native.md) · [Apple PR #137](https://github.com/chawon/ott/pull/137) |
| Chrome·Edge·Whale | [apps/browser-extension](../apps/browser-extension) | Chrome 공개 버전은 `0.1.0`, 저장소 manifest는 `0.1.1`이다. Edge·Whale의 최신 게시 버전은 확인 대상이다. Windows 빠른 기록 선택은 기존 확장이 여는 웹에서 제공한다. | [확장 Wiki](../wiki/pages/platforms/browser-extension.md) · [데스크톱 연결](desktop-protocol-and-extension-bridge-plan-2026-11-18.md) |
| 토스 인앱 | [토스 출시 브랜치](https://github.com/chawon/ott/tree/chore/toss-inapp-current-release-20260517)의 `apps/web` | `내 OTT 타임라인` 승인·출시 기록이 있다. 별도 빌드의 공개판을 유지하고 검색·기록·타임라인을 우선 검증한다. | [토스 인앱 Wiki](../wiki/pages/platforms/toss-inapp.md) |

운영 Web/API Deployment의 이미지와 Ready 상태, Argo CD의 `Synced` / `Healthy`를 읽기 전용으로 대조했다. 스토어의 버전 번호, 제출 상태, 설치 검증은 각 채널의 근거를 따른다.

Windows의 서버 계정 삭제는 현재 소스에서 호출 경로와 성공 처리의 불일치가 확인돼 있다. [삭제 정책과 Windows 구현 현황](../wiki/pages/features/delete-sync.md)

## 이전 설치와 연결 채널

- Android Bubblewrap TWA는 `1.0.19 (23)`까지의 배포 계열이다. 현재 Android 앱은 같은 Play 패키지를 이어받는다. 기존 설치 토큰으로 세션을 복구하거나, 호환 브라우저의 웹 세션과 로컬 기록을 핸드오프로 이어받는 경로를 유지한다. [Android 전환](android-native-v2-transition.md)
- Windows의 이전 Microsoft Store PWABuilder 패키지는 동일 스토어 제품의 네이티브 MSIX로 전환됐다. 브라우저/PWA의 계정과 기록 복구, `ottline://` 연결은 [데스크톱 계약](desktop-protocol-and-extension-bridge-plan-2026-11-18.md)을 따른다.
- ChatGPT 커넥터는 공개 서비스 미운영 상태다. 읽기 전용 [연결 계약](product-contracts.md#chatgpt-app)으로 실제 연결과 제출 자료를 다시 검증한다.

[브라우저 확장·토스 인앱·ChatGPT 앱 개편 방향](changes/v2-channel-strategy.md)에 각 채널의 다음 작업과 출시 판단 기준을 기록한다.
