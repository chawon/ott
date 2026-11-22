# 종료된 GitHub Actions 보관

`2026-11-22` [정리 업무 #166](https://github.com/chawon/ott/issues/166)의 보관 자료다. 현재 실행 경로는 [GitHub Actions 운영](../../docs/github-actions.md)을 따른다. 이 디렉터리는 `.github/workflows/` 밖에 있으므로 보관한 YAML은 Actions에서 실행되지 않는다.

| 원본 | 종료 이유 | 원본 기준 |
| --- | --- | --- |
| [android-debug.yml](android-debug.yml) | 이전 Flutter `apps/mobile`의 디버그 APK. main에 원본 파일이 없고 마지막 실행은 `2026-01-11`이다. 현재 Android는 Kotlin/Compose 앱이다. | 마지막 성공 run [20896121001](https://github.com/chawon/ott/actions/runs/20896121001), SHA `ca095188a3b640724b0a22a7c7a74c55eeabf7e4`에서 원본을 복사했다. |
| [native-ios-ci.yml](native-ios-ci.yml) | 이전 Expo React Native 검증. iOS·iPadOS 공개 앱은 SwiftUI v2로 전환됐다. | 정리 전 main `4db7be6`에서 내용 변경 없이 이동했다. |
| [native-ios-testflight.yml](native-ios-testflight.yml) | 이전 Expo/EAS 제출. 현재 SwiftUI v2의 TestFlight 워크플로가 별도로 있다. | 정리 전 main `4db7be6`에서 내용 변경 없이 이동했다. |

원본에는 당시의 소스 경로·트리거·도구 버전이 그대로 남아 있다. `apps/native`는 기존 설치판의 데이터 이전과 회귀 검증에 필요한 참고 소스로 유지한다. 이 파일들을 현행 워크플로 디렉터리에 복사하거나 이전 바이너리를 배포하려면 현재 스토어 버전·서명·데이터 이전 정책부터 다시 검토한다.

이전 Android TWA의 워크플로 3개는 별도 [TWA 보관함](../android-twa/workflows/)에 있다. 기존 run과 배포 증거를 삭제하는 정리가 아니다.
