# 개발 시작과 소스 구조

로컬 개발과 플랫폼별 소스의 출발점이다. 공통 작업 지침은 [AGENTS.md](../AGENTS.md), 현재 출시·전환 상태는 [플랫폼 현황](platforms.md), 설계·운영 문서는 [문서 지도](README.md)를 따른다.

아래 경로와 명령은 저장소 루트를 기준으로 읽는다.

## 소스 구조

| 경로 | 역할 |
| --- | --- |
| [apps/api](../apps/api) | 공통 API, PostgreSQL·Flyway, 인증·동기화·카탈로그 |
| [apps/web](../apps/web) | Next.js Web/PWA 및 관리자 화면 |
| [apps/android-native](../apps/android-native) | Kotlin·Jetpack Compose Android 앱 |
| [apps/ios-native](../apps/ios-native) | App Store에 출시된 SwiftUI iPhone·iPad 앱 |
| [apps/macos-native](../apps/macos-native) | Mac App Store에 출시된 SwiftUI macOS 앱 |
| [apps/apple-core](../apps/apple-core) | iOS·iPadOS·macOS 공용 저장·동기화·API 패키지 |
| [apps/native](../apps/native) | 이전 Expo React Native iOS 앱과 v2 업데이트 시 데이터 이전 참고 소스 |
| [apps/windows-native](../apps/windows-native) | .NET WPF Windows 앱 |
| [apps/browser-extension](../apps/browser-extension) | Chrome·Edge·Whale에서 빠른 기록으로 연결하는 확장 |
| [shared](../shared) | Web과 Expo iOS에서 사용하는 도서 플랫폼 데이터 |
| [deploy/oke](../deploy/oke) | 운영 Web/API의 GitOps 설정 |
| [archive](../archive) | 구형 Android TWA 소스·종료된 Actions와 초기 v2 디자인 시안 |

## 개발 시작

| 대상 | 시작점 |
| --- | --- |
| Web | 루트에서 `npm ci` 후 `npm run dev`. Web v2 로직 검사는 `npm run test:timeline-v2 --workspace ott`. |
| API | `apps/api`에서 `./gradlew test`. 개발 DB 구성은 [Docker Compose 설정](../apps/api/docker-compose.yml)을 참고합니다. |
| Android | [빌드와 테스트 가이드](../apps/android-native/README.md) |
| iOS·iPadOS | [SwiftUI 개발 및 배포 가이드](../apps/ios-native/DEVELOPMENT.md) |
| macOS | [SwiftUI 개발 가이드](../apps/macos-native/DEVELOPMENT.md) |
| Windows | [빌드와 패키징 가이드](../apps/windows-native/README.md) |
| 브라우저 확장 | [배포 Wiki](../wiki/pages/platforms/browser-extension.md)와 [패키지 워크플로우](../.github/workflows/browser-extension-package.yml) |

자동 검증과 수동 배포의 전체 경로는 [GitHub Actions 운영](github-actions.md)을 따른다. 이전 Expo iOS CI·TestFlight와 Flutter Android 디버그 빌드는 종료해 [보관함](../archive/github-actions/README.md)으로 옮겼다.
