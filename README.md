# ottline 개발 지휘부

ottline은 영상과 책을 기록하고 돌아보는 서비스입니다. 이 저장소에서 플랫폼 공통 정책과 API를 관리하고, 기능 변경을 각 앱에 어떻게 적용할지 문서로 남깁니다.

- [문서 지도](docs/README.md)에서 기능 계약, 구현 근거, 출시 기록을 찾습니다.
- [플랫폼 현황](docs/platforms.md)에서 소스 위치와 현재 출시·개발 상태를 확인합니다.
- [변경안을 작성합니다](docs/changes/README.md). 영향을 받는 앱, 데이터 호환성, 검증과 출시 순서를 기록합니다.
- [Wiki](wiki/index.md)는 제품·플랫폼별 현재 동작을 찾는 데 사용합니다. 이전 운영 자료는 [문서 아카이브](docs/archive/README.md)와 [Wiki 아카이브](wiki/archive/README.md)에 있습니다.

## 소스 구조

| 경로 | 역할 |
| --- | --- |
| [apps/api](apps/api) | 공통 API, PostgreSQL·Flyway, 인증·동기화·카탈로그 |
| [apps/web](apps/web) | Next.js Web/PWA 및 관리자 화면 |
| [apps/android-native](apps/android-native) | Kotlin·Jetpack Compose Android 앱 |
| [apps/ios-native](apps/ios-native) | App Store에 출시된 SwiftUI iPhone·iPad 앱 |
| [apps/macos-native](apps/macos-native) | Mac App Store에 출시된 SwiftUI macOS 앱 |
| [apps/apple-core](apps/apple-core) | iOS·iPadOS·macOS 공용 저장·동기화·API 패키지 |
| [apps/native](apps/native) | 이전 Expo React Native iOS 앱과 v2 업데이트 시 데이터 이전 참고 소스 |
| [apps/windows-native](apps/windows-native) | .NET WPF Windows 앱 |
| [apps/browser-extension](apps/browser-extension) | Chrome·Edge·Whale에서 빠른 기록으로 연결하는 확장 |
| [shared](shared) | Web과 Expo iOS에서 사용하는 도서 플랫폼 데이터 |
| [deploy/oke](deploy/oke) | 운영 Web/API의 GitOps 설정 |
| [archive](archive) | 구형 Android TWA 소스와 초기 v2 디자인 시안 |

2026-11-22 사용자 확인 기준 macOS·iOS·iPadOS v2 출시가 완료됐습니다. 설치 링크와 출시 후 확인은 [플랫폼 현황](docs/platforms.md)과 [Apple 후속 작업](docs/changes/v2-follow-up.md#2-apple-v2-업데이트-검증)에서 확인합니다. 토스 인앱의 별도 출시 소스도 플랫폼 현황에서 연결합니다.

## 개발 시작

| 대상 | 시작점 |
| --- | --- |
| Web | 루트에서 `npm ci` 후 `npm run dev`. Web v2 로직 검사는 `npm run test:timeline-v2 --workspace ott`. |
| API | `apps/api`에서 `./gradlew test`. 개발 DB 구성은 [Docker Compose 설정](apps/api/docker-compose.yml)을 참고합니다. |
| Android | [빌드와 테스트 가이드](apps/android-native/README.md) |
| iOS·iPadOS | [SwiftUI 개발 및 배포 가이드](apps/ios-native/DEVELOPMENT.md) |
| macOS | [SwiftUI 개발 가이드](apps/macos-native/DEVELOPMENT.md) |
| Windows | [빌드와 패키징 가이드](apps/windows-native/README.md) |
| 브라우저 확장 | [배포 Wiki](wiki/pages/platforms/browser-extension.md)와 [패키지 워크플로우](.github/workflows/browser-extension-package.yml) |
