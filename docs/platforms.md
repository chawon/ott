# 플랫폼별 소스와 출시 현황

기준 소스는 [main `37eda7f`](https://github.com/chawon/ott/commit/37eda7f)이다. Apple 출시 상태(`2026-11-22` 사용자 확인)와 Android `2.0.5 (29)` Play 배포 기록을 반영했다. 버전은 확인한 운영 이미지 또는 게시·배포 기록을 적는다.

| 대상 | 구현 소스 | 출시·개발 상태 | 기록 |
| --- | --- | --- | --- |
| 공통 API | [apps/api](../apps/api) | 운영 `7e9913d`([PR #144](https://github.com/chawon/ott/pull/144)). Android·Windows·macOS·iOS의 연결 기기 표기와 `gpt-6-luna` `reasoning.effort=none`·카탈로그 4초 마감·단계별 타이밍 로그를 포함한다. | [API/데이터 계약](product-contracts.md) · [운영 설정](../deploy/oke/api-deployment.yaml) |
| Web/PWA | [apps/web](../apps/web) | 운영 `4472ad3`, v2 Web/PWA 및 확장 → Windows 빠른 기록 링크 포함. 브라우저 설치형 PWA를 제공한다. | [PWA](../wiki/pages/platforms/pwa.md) · [Web 개편 배포](ottline-v2-production-rollout.md) · [운영 설정](../deploy/oke/web-deployment.yaml) |
| Android | [apps/android-native](../apps/android-native) | Google Play `app.ottline`, Kotlin/Compose 기반. `main` `37eda7f`([PR #146](https://github.com/chawon/ott/pull/146)·[PR #148](https://github.com/chawon/ott/pull/148)) 기준 **`2.0.5 (29)`**을 `production` 트랙(`status=completed`, `rollout=1.0`)에 업로드했고, 구 비공개 테스트(`13 / 1.0.9`) 중지 및 Play Console 7"·10" 태블릿 스크린샷(한·영 각 5장) 등록·검토 제출을 마쳤다(`2026-11-22`). Play 심사 승인·공개 게시 대기 중이다. | [Android Wiki](../wiki/pages/platforms/android-native.md) · [Play 배포 run](https://github.com/chawon/ott/actions/runs/44981269777) · [전환과 복구](android-native-v2-transition.md) |
| iOS·iPadOS | [apps/ios-native](../apps/ios-native) · [apps/apple-core](../apps/apple-core) | SwiftUI v2 **`2.0.0` 출시 완료**(`2026-11-22` 사용자 확인, iOS/iPadOS `16.0+`) 및 Apple 한국 공개 조회 `2.0.0` 확인. 제출 빌드는 `27`, 코드 `2634fdc`([PR #137](https://github.com/chawon/ott/pull/137)). [CI](https://github.com/chawon/ott/actions/runs/44897582945)·서명 실기기 검증을 마쳤으며, 기존 Expo 설치판 위 공개 스토어 업데이트의 데이터 보존 확인을 후속 추적한다. | [iOS·iPadOS Wiki](../wiki/pages/platforms/native.md) · [App Store](https://apps.apple.com/app/id6780318110) · [출시 후 검증](changes/v2-follow-up.md#2-apple-v2-업데이트-검증) |
| Windows | [apps/windows-native](../apps/windows-native) | Microsoft Store 공개 버전 `2.0.0.0` (`Published`). `main` `1fb24ee`([PR #140](https://github.com/chawon/ott/pull/140)) 기준 서버 계정 삭제 수정본 `2.0.1.0`을 Partner Center에 제출해 `Certification` 심사 중이다(Submission `1152921505702457337`, `Errors: 0`). | [Windows Wiki](../wiki/pages/platforms/windows-native.md) · [스토어 전환 기록](windows-native-v2-transition.md) |
| macOS | [apps/macos-native](../apps/macos-native) · [apps/apple-core](../apps/apple-core) | SwiftUI v2 **최초 출시 완료**(`2026-11-22` 사용자 확인, `macOS 14.0+`, App Sandbox). 제출 버전 `2.0.0 (27)`, 코드 `2634fdc`([PR #137](https://github.com/chawon/ott/pull/137)). [CI](https://github.com/chawon/ott/actions/runs/44897582916)·서명 실기기 검증을 마쳤으며, 공개 스토어 설치판의 Safari·Chrome 이어받기와 Web/확장 연결 활성화는 후속 업무다. | [macOS Wiki](../wiki/pages/platforms/macos-native.md) · [Mac App Store](https://apps.apple.com/app/id6780318110?platform=mac) · [출시 후 검증](changes/v2-follow-up.md#2-apple-v2-업데이트-검증) |
| Chrome·Edge·Whale | [apps/browser-extension](../apps/browser-extension) | Chrome 공개 버전은 `0.1.0`, 저장소 manifest는 `0.1.1`이다. Edge·Whale의 최신 게시 버전은 확인 대상이다. Windows 빠른 기록 선택은 기존 확장이 여는 웹에서 제공한다. | [확장 Wiki](../wiki/pages/platforms/browser-extension.md) · [데스크톱 연결](desktop-protocol-and-extension-bridge-plan-2026-11-18.md) |
| 토스 인앱 | [토스 출시 브랜치](https://github.com/chawon/ott/tree/chore/toss-inapp-current-release-20260517)의 `apps/web` | `내 OTT 타임라인` 승인·출시 기록이 있다. 별도 빌드의 공개판을 유지하고 검색·기록·타임라인을 우선 검증한다. | [토스 인앱 Wiki](../wiki/pages/platforms/toss-inapp.md) |

Apple 이외의 운영 이미지·스토어 상태는 기존 확인 기록을 유지했다. Web/API Deployment의 이미지·Ready 상태와 Argo CD의 `Synced` / `Healthy`는 이전 읽기 전용 대조 기록이며 이번 문서 갱신에서 재조회하지 않았다. 스토어의 버전 번호, 제출 상태, 설치 검증은 각 채널의 근거를 따른다.

Apple 공개 버전의 추가 근거는 [한국 스토어 조회](https://itunes.apple.com/lookup?id=6780318110&country=kr&entity=software)의 iOS `2.0.0`, `iosUniversal`, 공개 시각 `2026-11-22 08:11 KST`다. 이 조회는 빌드 번호나 macOS의 공개 상태를 독립적으로 증명하지 않으며, 세 플랫폼의 출시 완료는 사용자 확인을 근거로 기록한다. [출시 완료 카드](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827691)

공개 서비스 소개·가이드의 macOS 추가와 iPhone·iPad 안내는 [Web/PWA 담당 업무](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827749)로 추적한다. 이 문서 갱신은 해당 Web 변경의 배포 완료를 뜻하지 않는다.

Windows의 서버 계정 삭제는 현재 공개 스토어판(`2.0.0.0`)에서 호출 경로와 성공 처리 불일치가 남아 있으며, `main` `1fb24ee`([PR #140](https://github.com/chawon/ott/pull/140))에서 수정·CI 검증을 마치고 Microsoft Store `2.0.1.0` 심사(`Certification`, Submission `1152921505702457337`) 진행 중이다(공개 게시 및 스토어 설치판 확인 대기). [삭제 정책과 Windows 구현 현황](../wiki/pages/features/delete-sync.md)

## 이전 설치와 연결 채널

- Android Bubblewrap TWA는 `1.0.19 (23)`까지의 배포 계열이다. 현재 Android 앱은 같은 Play 패키지를 이어받는다. 기존 설치 토큰으로 세션을 복구하거나, 호환 브라우저의 웹 세션과 로컬 기록을 핸드오프로 이어받는 경로를 유지한다. [Android 전환](android-native-v2-transition.md)
- Windows의 이전 Microsoft Store PWABuilder 패키지는 동일 스토어 제품의 네이티브 MSIX로 전환됐다. 브라우저/PWA의 계정과 기록 복구, `ottline://` 연결은 [데스크톱 계약](desktop-protocol-and-extension-bridge-plan-2026-11-18.md)을 따른다.
- iPhone·iPad는 같은 App Store 앱의 Expo `1.0.4 (24)`에서 SwiftUI v2로 전환됐다. 이전 [apps/native](../apps/native)와 [Expo 개발·배포 기록](../apps/native/DEVELOPMENT.md)은 데이터 이전·업데이트 검증을 위해 보존한다.
- ChatGPT 커넥터는 공개 서비스 미운영 상태다. 읽기 전용 [연결 계약](product-contracts.md#chatgpt-app)으로 실제 연결과 제출 자료를 다시 검증한다.

[브라우저 확장·토스 인앱·ChatGPT 앱 개편 방향](changes/v2-channel-strategy.md)에 각 채널의 다음 작업과 출시 판단 기준을 기록한다.
