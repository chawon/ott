# GitHub Actions 운영

현재 플랫폼의 검증·패키징·배포 시작점이다. [플랫폼 현황](platforms.md), [Web/API 배포 운영](staging-environment-plan.md)과 함께 읽는다. `2026-11-22` 정리 업무는 [#166](https://github.com/chawon/ott/issues/166)에서 추적한다.

## 현재 워크플로

`.github/workflows/`에는 아래 11개를 유지한다. 실제 설치·스토어 공개 검증은 플랫폼별 출시 업무로 별도 기록한다.

| 대상 | 워크플로 | 실행 방식과 역할 |
| --- | --- | --- |
| API 검증 | [Verify API](../.github/workflows/deploy-api.yml) | API·공통 코드 및 해당 정의의 PR/main 변경, 수동 실행. 테스트·이미지 검증. |
| API 운영 | [Deploy API to Production](../.github/workflows/deploy-api-production.yml) | 수동 실행. 검증된 main SHA로 운영 이미지와 manifest 갱신. |
| Web 검증 | [Verify Web](../.github/workflows/deploy-web.yml) | Web·공통 코드·npm 설정 및 해당 정의의 PR/main 변경, 수동 실행. 테스트·이미지·런타임 검증. |
| Web 운영 | [Deploy Web to Production](../.github/workflows/deploy-web-production.yml) | 수동 실행. 검증된 main SHA로 운영 이미지와 manifest 갱신. |
| Android | [Build & Deploy Native Android Release AAB](../.github/workflows/native-android-release.yml) | 수동 실행. Kotlin/Compose 앱의 테스트·Lint·서명 AAB와 선택한 Play 트랙 업로드. |
| iOS·iPadOS 검증 | [Native iOS v2 CI (SwiftUI)](../.github/workflows/native-ios-v2-ci.yml) | SwiftUI·공유 Apple 코드 등의 PR/main 변경, 수동 실행. 시뮬레이터 빌드·테스트. |
| iOS·iPadOS 제출 | [Build & Deploy Native iOS v2 TestFlight IPA](../.github/workflows/native-ios-v2-release.yml) | 수동 실행. SwiftUI 앱 서명·IPA 및 TestFlight 제출. |
| macOS | [Native macOS v2 CI (SwiftUI)](../.github/workflows/native-macos-v2-ci.yml) | macOS·공유 Apple 코드 등의 PR/main 변경, 수동 실행. 빌드·테스트. 서명·스토어 제출은 macOS 개발 가이드의 별도 절차. |
| Windows 검증 | [Native Windows CI](../.github/workflows/native-windows-ci.yml) | Windows 코드 등의 PR/main 변경, 수동 실행. 빌드·테스트·패키지 검증. |
| Windows 제출 | [Build & Deploy Native Windows MSIXBundle](../.github/workflows/native-windows-release.yml) | 수동 실행. MSIXBundle 서명·생성 및 선택한 Store 제출. |
| Chrome·Edge·Whale | [Package Browser Extension](../.github/workflows/browser-extension-package.yml) | 확장·웹 연결 진입 및 해당 정의의 PR/main 변경, 수동 실행. 확장 테스트·ZIP 보관. 스토어별 공개 게시와 구분. |

워크플로의 표시 이름·파일 경로·job 이름은 기존 호출 및 확인 링크에 쓰이므로 이번 정리에서 현행 11개의 이름이나 정의를 바꾸지 않는다. 토스는 별도 출시 브랜치 경로를 따르고 ChatGPT 앱은 미운영 상태여서, 여기에 새 배포 작업을 추가하지 않는다.

API 의존 변경은 **검증된 SHA의 API → 실제 API 확인 → 동일 SHA의 Web** 순서로 배포한다. 정리 작업으로 production 워크플로를 실행하거나 상시 staging을 다시 만들지 않는다.

## 종료한 항목

| 이전 표시 이름 / workflow ID | 처리와 대체 경로 |
| --- | --- |
| Android Debug APK / `222562453` | main에 없는 이전 Flutter `apps/mobile` 빌드. GitHub 등록을 비활성화하고 마지막 실행 SHA의 YAML을 보관한다. 대체: Android Native AAB. |
| Native iOS CI / `296019126` | Expo 검증 정의를 실행 경로에서 제거하고 GitHub 등록을 비활성화한다. 대체: SwiftUI v2 CI. |
| Native iOS TestFlight / `296020115` | Expo/EAS 제출 정의를 실행 경로에서 제거하고 GitHub 등록을 비활성화한다. 대체: SwiftUI v2 TestFlight. |

원본은 [종료된 Actions 보관함](../archive/github-actions/README.md)에 있다. 이전 TWA 정의는 [TWA 보관함](../archive/android-twa/README.md)에 이미 분리되어 있다. 과거 실행 내역·로그와 배포 증거는 유지한다. 비활성 항목의 과거 실행 화면이 남는 것은 정상이다.

## 다시 정리할 때

1. `gh workflow list --repo chawon/ott --all`과 main의 `.github/workflows/`를 대조한다. 오래된 이름이나 최근 실행이 없다는 이유만으로 현행 릴리스 경로를 종료하지 않는다.
2. 호출·필수 체크·ruleset·진행 중인 작업과 플랫폼 출시·복구 경로를 확인한다. 원본 SHA와 마지막 실행 근거를 이슈에 남긴다.
3. 종료한 정의를 실행 디렉터리 밖에 보관하고 PR로 검토한다. 종료 대상으로 확인된 GitHub workflow ID만 비활성화한다.
4. main과 실제 활성 목록이 일치하는지 확인한다. 활성 워크플로, 과거 run 및 시크릿을 일괄 삭제하지 않는다. `TWA_KEYSTORE_*`처럼 현행 Android Native에서 재사용하는 서명 설정도 있다.
