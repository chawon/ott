# 플랫폼별 소스와 출시 현황

Web·API 운영 소스는 [main `c693fd8`](https://github.com/chawon/ott/commit/c693fd86f49d5433350ad7e61b2ec53fd9bab055)이며, [2026-11-22 통합 배포](web-api-rollout-2026-11-22.md)의 실제 이미지·API 확인을 반영했다. Apple 출시 상태는 같은 날 사용자 확인, Android `2.0.5 (29)`와 Windows는 각 게시·배포 기록을 따른다. 운영 이미지, 스토어 제출, 공개 게시와 실기기 검증을 구분한다.

| 대상 | 구현 소스 | 출시·개발 상태 | 기록 |
| --- | --- | --- | --- |
| 공통 API | [apps/api](../apps/api) | 운영 `c693fd8`. 큐레이터 공개 `200 []`·관리자 쓰기 `410`과 자동화 종료, iPad·Android 태블릿 기기 표기를 포함한다. 기존 #144의 추천·기기 계약을 유지하며 실제 API·보관 자료·합성 UA 13개 시나리오/기존 ID 보존을 확인했다. | [통합 운영 반영](web-api-rollout-2026-11-22.md) · [API/데이터 계약](product-contracts.md) · [운영 설정](../deploy/oke/api-deployment.yaml) |
| Web/PWA | [apps/web](../apps/web) | 운영 `c693fd8`. 함께 상세 초기 상태·큰 화면 2단·큐레이터 제거, Apple 서비스 안내·ChatGPT 안내 제외, 추천 재시도 복구를 포함한다. 실제 설치형 PWA와 Mac 설치판 연결의 남은 조건은 담당 카드에서 추적한다. | [통합 운영 반영](web-api-rollout-2026-11-22.md) · [PWA](../wiki/pages/platforms/pwa.md) · [운영 설정](../deploy/oke/web-deployment.yaml) |
| Android | [apps/android-native](../apps/android-native) | Google Play `app.ottline`, Kotlin/Compose 기반. `main` `37eda7f`([PR #146](https://github.com/chawon/ott/pull/146)·[PR #148](https://github.com/chawon/ott/pull/148)) 기준 **`2.0.5 (29)`**을 `production` 트랙(`status=completed`, `rollout=1.0`)에 업로드했고, 구 비공개 테스트(`13 / 1.0.9`) 중지 및 Play Console 7"·10" 태블릿 스크린샷(한·영 각 5장) 등록·검토 제출을 마쳤다(`2026-11-22`). Play 심사 승인·공개 게시 대기 중이다. | [Android Wiki](../wiki/pages/platforms/android-native.md) · [Play 배포 run](https://github.com/chawon/ott/actions/runs/44981269777) · [전환과 복구](android-native-v2-transition.md) |
| iOS·iPadOS | [apps/ios-native](../apps/ios-native) · [apps/apple-core](../apps/apple-core) | SwiftUI v2 **`2.0.0` 출시 완료**(`2026-11-22` 사용자 확인, iOS/iPadOS `16.0+`) 및 Apple 한국 공개 조회 `2.0.0` 확인. 제출 빌드는 `27`, 코드 `2634fdc`([PR #137](https://github.com/chawon/ott/pull/137)). [CI](https://github.com/chawon/ott/actions/runs/44897582945)·서명 실기기 검증을 마쳤으며, 기존 Expo 설치판 위 공개 스토어 업데이트의 데이터 보존 확인을 후속 추적한다. | [iOS·iPadOS Wiki](../wiki/pages/platforms/native.md) · [App Store](https://apps.apple.com/app/id6780318110) · [출시 후 검증](changes/v2-follow-up.md#2-apple-v2-업데이트-검증) |
| Windows | [apps/windows-native](../apps/windows-native) | Microsoft Store 공개 버전 `2.0.0.0` (`Published`). `main` `1fb24ee`([PR #140](https://github.com/chawon/ott/pull/140)) 기준 서버 계정 삭제 수정본 `2.0.1.0`이 Partner Center `Certification` 심사 중이다(Submission `1152921505702457337`, `Errors: 0`). 후속 추천 복구·큐레이터 제거·함께 2단·공통 풋터/안내 5종은 `main` `b6baa17`([PR #156](https://github.com/chawon/ott/pull/156), [main CI](https://github.com/chawon/ott/actions/runs/45000851496)) 병합 완료 상태이며, `2.0.1.0` 게시 후 `2.0.2.0` 제출 및 스토어 설치판 확인이 남아 있다. | [Windows Wiki](../wiki/pages/platforms/windows-native.md) · [스토어 전환 기록](windows-native-v2-transition.md) |
| macOS | [apps/macos-native](../apps/macos-native) · [apps/apple-core](../apps/apple-core) | SwiftUI v2 **최초 출시 완료**(`2026-11-22` 사용자 확인, `macOS 14.0+`, App Sandbox). 제출 버전 `2.0.0 (27)`, 코드 `2634fdc`([PR #137](https://github.com/chawon/ott/pull/137)). [CI](https://github.com/chawon/ott/actions/runs/44897582916)·서명 실기기 검증을 마쳤으며, 공개 스토어 설치판의 Safari·Chrome 이어받기와 Web/확장 연결 활성화는 후속 업무다. | [macOS Wiki](../wiki/pages/platforms/macos-native.md) · [Mac App Store](https://apps.apple.com/app/id6780318110?platform=mac) · [출시 후 검증](changes/v2-follow-up.md#2-apple-v2-업데이트-검증) |
| Chrome·Edge·Whale | [apps/browser-extension](../apps/browser-extension) | Chrome 공개 버전은 `0.1.0`, 저장소 manifest는 `0.1.1`이다. Edge·Whale의 최신 게시 버전은 확인 대상이다. Windows 빠른 기록 선택은 기존 확장이 여는 웹에서 제공한다. | [확장 Wiki](../wiki/pages/platforms/browser-extension.md) · [데스크톱 연결](desktop-protocol-and-extension-bridge-plan-2026-11-18.md) |
| 토스 인앱 | [토스 출시 브랜치](https://github.com/chawon/ott/tree/chore/toss-inapp-current-release-20260517)의 `apps/web` | `내 OTT 타임라인` 승인·출시 기록이 있다. 별도 빌드의 공개판을 유지하고 검색·기록·타임라인을 우선 검증한다. | [토스 인앱 Wiki](../wiki/pages/platforms/toss-inapp.md) |

Web/API Deployment의 실제 이미지·`APP_VERSION=c693fd8`·Ready와 Argo CD `Synced Healthy`는 이번 배포에서 재조회했다. 다른 스토어의 버전·심사·공개·설치 검증은 각 채널의 기존 근거를 유지한다.

Apple 공개 버전의 추가 근거는 [한국 스토어 조회](https://itunes.apple.com/lookup?id=6780318110&country=kr&entity=software)의 iOS `2.0.0`, `iosUniversal`, 공개 시각 `2026-11-22 08:11 KST`다. 이 조회는 빌드 번호나 macOS의 공개 상태를 독립적으로 증명하지 않으며, 세 플랫폼의 출시 완료는 사용자 확인을 근거로 기록한다. [출시 완료 카드](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827691)

공개 서비스 소개·가이드의 macOS·iPhone·iPad 안내와 미운영 ChatGPT 노출 제외는 Web `c693fd8`로 배포했다. [Web/PWA 담당 업무](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827749)의 Safari/Chrome·Mac 설치판/PWA 확인은 별도로 추적한다.

Windows의 서버 계정 삭제는 현재 공개 스토어판(`2.0.0.0`)에서 호출 경로와 성공 처리 불일치가 남아 있으며, `main` `1fb24ee`([PR #140](https://github.com/chawon/ott/pull/140))에서 수정·CI 검증을 마치고 Microsoft Store `2.0.1.0` 심사(`Certification`, Submission `1152921505702457337`) 진행 중이다(공개 게시 및 스토어 설치판 확인 대기). [삭제 정책과 Windows 구현 현황](../wiki/pages/features/delete-sync.md)

## 이전 설치와 연결 채널

- Android Bubblewrap TWA는 `1.0.19 (23)`까지의 배포 계열이다. 현재 Android 앱은 같은 Play 패키지를 이어받는다. 기존 설치 토큰으로 세션을 복구하거나, 호환 브라우저의 웹 세션과 로컬 기록을 핸드오프로 이어받는 경로를 유지한다. [Android 전환](android-native-v2-transition.md)
- Windows의 이전 Microsoft Store PWABuilder 패키지는 동일 스토어 제품의 네이티브 MSIX로 전환됐다. 브라우저/PWA의 계정과 기록 복구, `ottline://` 연결은 [데스크톱 계약](desktop-protocol-and-extension-bridge-plan-2026-11-18.md)을 따른다.
- iPhone·iPad는 같은 App Store 앱의 Expo `1.0.4 (24)`에서 SwiftUI v2로 전환됐다. 이전 [apps/native](../apps/native)와 [Expo 개발·배포 기록](../apps/native/DEVELOPMENT.md)은 데이터 이전·업데이트 검증을 위해 보존한다.
- ChatGPT 커넥터는 공개 서비스 미운영 상태다. 읽기 전용 [연결 계약](product-contracts.md#chatgpt-app)으로 실제 연결과 제출 자료를 다시 검증한다.

[브라우저 확장·토스 인앱·ChatGPT 앱 개편 방향](changes/v2-channel-strategy.md)에 각 채널의 다음 작업과 출시 판단 기준을 기록한다.
