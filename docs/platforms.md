# 플랫폼별 소스와 출시 현황

기준 소스는 [main `d0844fc`](https://github.com/chawon/ott/commit/d0844fc)이다. 버전은 확인한 운영 이미지 또는 게시·배포 기록을 적는다.

| 대상 | 구현 소스 | 출시·개발 상태 | 기록 |
| --- | --- | --- | --- |
| 공통 API | [apps/api](../apps/api) | 운영 `7e9913d`([PR #144](https://github.com/chawon/ott/pull/144)). Android·Windows·macOS·iOS의 연결 기기 표기와 `gpt-6-luna` `reasoning.effort=none`·카탈로그 4초 마감·단계별 타이밍 로그를 포함한다. | [API/데이터 계약](product-contracts.md) · [운영 설정](../deploy/oke/api-deployment.yaml) |
| Web/PWA | [apps/web](../apps/web) | 운영 `4472ad3`, v2 Web/PWA 및 확장 → Windows 빠른 기록 링크 포함. 브라우저 설치형 PWA를 제공한다. | [PWA](../wiki/pages/platforms/pwa.md) · [Web 개편 배포](ottline-v2-production-rollout.md) · [운영 설정](../deploy/oke/web-deployment.yaml) |
| Android | [apps/android-native](../apps/android-native) | Google Play `app.ottline`, Kotlin/Compose 기반. 배포 워크플로우에서 확인한 버전은 `2.0.4 (28)`. 운영 API는 기존 앱의 User-Agent로 기기를 구분한다. main의 전용 플랫폼 헤더는 다음 바이너리 변경에 해당한다. | [Android Wiki](../wiki/pages/platforms/android-native.md) · [Play 배포 run](https://github.com/chawon/ott/actions/runs/44111552653) · [전환과 복구](android-native-v2-transition.md) |
| iOS | [apps/ios-native](../apps/ios-native) · [apps/apple-core](../apps/apple-core) *(공개 구버전 [apps/native](../apps/native))* | App Store 공개판은 Expo React Native `1.0.4 (24)`. SwiftUI v2(`iOS 16.0+`)는 [PR #137](https://github.com/chawon/ott/pull/137)(`main` `d0844fc`, 코드 `2634fdc`) 병합·CI 통과([run `44897582945`](https://github.com/chawon/ott/actions/runs/44897582945)) 및 실기기(iPhone X `iOS 16.7.16`·iPad 10세대) 검증 후 App Store Connect에 **`2.0.0 (27)`** 심사 제출 완료(공개 승인 대기). | [iOS Wiki](../wiki/pages/platforms/native.md) · [App Store](https://apps.apple.com/app/ottline/id6780318110) · [Apple PR #137](https://github.com/chawon/ott/pull/137) |
| Windows | [apps/windows-native](../apps/windows-native) | Microsoft Store 공개 버전 `2.0.0.0` (`Published`). `main` `1fb24ee`([PR #140](https://github.com/chawon/ott/pull/140)) 기준 서버 계정 삭제 수정본 `2.0.1.0`을 Partner Center에 제출해 `Certification` 심사 중이다(Submission `1152921505702457337`, `Errors: 0`). | [Windows Wiki](../wiki/pages/platforms/windows-native.md) · [스토어 전환 기록](windows-native-v2-transition.md) |
| macOS | [apps/macos-native](../apps/macos-native) · [apps/apple-core](../apps/apple-core) | SwiftUI v2(`macOS 14.0+`, App Sandbox) [PR #137](https://github.com/chawon/ott/pull/137)(`main` `d0844fc`, 코드 `2634fdc`) 병합·CI 통과([run `44897582916`](https://github.com/chawon/ott/actions/runs/44897582916)) 및 실기기 검증 후 App Store Connect(`id6780318110` macOS 플랫폼)에 **`2.0.0 (27)`** 최초 심사 제출 완료(공개 승인·웹 연결 활성화 대기, Web/PWA도 병행 제공). | [macOS Wiki](../wiki/pages/platforms/macos-native.md) · [Apple PR #137](https://github.com/chawon/ott/pull/137) |
| Chrome·Edge·Whale | [apps/browser-extension](../apps/browser-extension) | Chrome 공개 버전은 `0.1.0`, 저장소 manifest는 `0.1.1`이다. Edge·Whale의 최신 게시 버전은 확인 대상이다. Windows 빠른 기록 선택은 기존 확장이 여는 웹에서 제공한다. | [확장 Wiki](../wiki/pages/platforms/browser-extension.md) · [데스크톱 연결](desktop-protocol-and-extension-bridge-plan-2026-11-18.md) |
| 토스 인앱 | [토스 출시 브랜치](https://github.com/chawon/ott/tree/chore/toss-inapp-current-release-20260517)의 `apps/web` | `내 OTT 타임라인` 승인·출시 기록이 있다. 별도 빌드의 공개판을 유지하고 검색·기록·타임라인을 우선 검증한다. | [토스 인앱 Wiki](../wiki/pages/platforms/toss-inapp.md) |

운영 Web/API Deployment의 이미지와 Ready 상태, Argo CD의 `Synced` / `Healthy`를 읽기 전용으로 대조했다. 스토어의 버전 번호, 제출 상태, 설치 검증은 각 채널의 근거를 따른다.

Windows의 서버 계정 삭제는 현재 공개 스토어판(`2.0.0.0`)에서 호출 경로와 성공 처리 불일치가 남아 있으며, `main` `1fb24ee`([PR #140](https://github.com/chawon/ott/pull/140))에서 수정·CI 검증을 마치고 Microsoft Store `2.0.1.0` 심사(`Certification`, Submission `1152921505702457337`) 진행 중이다(공개 게시 및 스토어 설치판 확인 대기). [삭제 정책과 Windows 구현 현황](../wiki/pages/features/delete-sync.md)

## 이전 설치와 연결 채널

- Android Bubblewrap TWA는 `1.0.19 (23)`까지의 배포 계열이다. 현재 Android 앱은 같은 Play 패키지를 이어받는다. 기존 설치 토큰으로 세션을 복구하거나, 호환 브라우저의 웹 세션과 로컬 기록을 핸드오프로 이어받는 경로를 유지한다. [Android 전환](android-native-v2-transition.md)
- Windows의 이전 Microsoft Store PWABuilder 패키지는 동일 스토어 제품의 네이티브 MSIX로 전환됐다. 브라우저/PWA의 계정과 기록 복구, `ottline://` 연결은 [데스크톱 계약](desktop-protocol-and-extension-bridge-plan-2026-11-18.md)을 따른다.
- ChatGPT 커넥터는 공개 서비스 미운영 상태다. 읽기 전용 [연결 계약](product-contracts.md#chatgpt-app)으로 실제 연결과 제출 자료를 다시 검증한다.

[브라우저 확장·토스 인앱·ChatGPT 앱 개편 방향](changes/v2-channel-strategy.md)에 각 채널의 다음 작업과 출시 판단 기준을 기록한다.
