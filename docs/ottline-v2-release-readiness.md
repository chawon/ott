# ottline v2 전환 기록

v2 개편을 시작할 때의 출시 준비 문서는 [당시 원문](https://github.com/chawon/ott/blob/3920e3025ec89807b645416213812950d8abc86c/docs/ottline-v2-release-readiness.md)으로 보관한다. 현재 소스·버전과 미완료 작업은 [플랫폼 현황](platforms.md)에 기록한다.

| 전환 | 공개·검증 근거 |
| --- | --- |
| Web/PWA·API | [Web v2 운영 배포](ottline-v2-production-rollout.md)에서 PR #125·#126, V32, API → Web 배포와 기존 기록 보존을 확인했다. |
| Android | [Android Native 전환](android-native-v2-transition.md)에서 기존 Play 앱의 네이티브 전환과 TWA 계정·기록 복구를 다룬다. |
| Windows | [Windows Native 전환](windows-native-v2-transition.md)에서 같은 스토어 제품으로 전환한 패키지와 기존 PWA에서의 이어받기 검증을 다룬다. |
| 데스크톱·확장 | [데스크톱 연결 계약](desktop-protocol-and-extension-bridge-plan-2026-11-18.md)에서 확장 → Web → Windows 운영 반영과 macOS 연동 조건을 다룬다. |
| Apple | App Store에 공개된 iOS Expo 앱과 별도로 [SwiftUI iOS·macOS PR #137](https://github.com/chawon/ott/pull/137)이 진행 중이다. |
| 브랜드 | [CI 자산 통합 기록](ottline-ci-v2-integration.md)에 아이콘·스토어 자료의 원본과 적용 이력이 있다. |

추천 기능의 데이터 전송 범위와 안내는 [미래의 타임라인 정책](future-timeline-account-policy.md)에 있다. 이후 출시나 변경을 준비할 때는 [변경안 양식](changes/README.md)에 앱별 실기기 검증, 호환성과 스토어 자료를 기록한다.
