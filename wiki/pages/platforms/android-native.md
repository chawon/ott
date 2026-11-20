# Android 앱

Kotlin · Jetpack Compose · Room · WorkManager 기반의 Google Play용 앱. `2026-11-09`부터 기존 Bubblewrap TWA를 네이티브 앱으로 이전했다.

## 운영 상태

기준일 2026-11-20.

| 항목 | 확인 내용 |
|---|---|
| 최신 배포 기록 | `2.0.4` (`versionCode=28`), 2026-11-18 KST, 빌드와 Google Play 배포 단계 성공 |
| 앱 식별자 | `app.ottline`, Debug 기본 `app.ottline.dev` |
| 지원 버전 | 최소 Android 7.0(API 24), `targetSdk=36`, `compileSdk=36` |
| 소스와 검증 | [apps/android-native](../../../apps/android-native/), [Android 빌드·릴리스 워크플로](../../../.github/workflows/native-android-release.yml) |

버전과 배포 결과의 근거는 [빌드·배포 실행 44111552653](https://github.com/chawon/ott/actions/runs/44111552653)이다. 로컬 빌드와 서명 절차는 [Android 개발 가이드](../../../apps/android-native/README.md)를 참고한다.

## 주요 진입점과 데이터

- [LauncherActivity.kt](../../../apps/android-native/app/src/main/java/app/ottline/LauncherActivity.kt)와 [OttlineAppRoot.kt](../../../apps/android-native/app/src/main/java/app/ottline/ui/OttlineAppRoot.kt)에서 딥링크와 화면을 연결한다.
- [QuickRecordDialog.kt](../../../apps/android-native/app/src/main/java/app/ottline/ui/screens/QuickRecordDialog.kt)는 작품 선택 후 최초 기록을 저장하고 별도 단계에서 장소·상황·메모 등 부가 정보를 보완한다. `2.0.4`는 서버 동기화 뒤 정규 ID가 바뀌어도 기존 기록에 부가 정보를 저장하고 이미 생긴 로컬 중복을 병합한다. [PR #134](https://github.com/chawon/ott/pull/134)
- [OttlineRepository.kt](../../../apps/android-native/app/src/main/java/app/ottline/data/OttlineRepository.kt)는 Room의 기록과 outbox를 관리한다. WorkManager가 연결 복구 시 서버와 동기화한다.

## 기존 TWA 사용자 이전

설치 토큰에 서버 매핑이 있으면 업데이트한 앱이 먼저 기존 기기 세션을 복원하고 기록을 동기화한다. 서버에서 세션을 복원할 수 없으면 기존 TWA가 사용한 브라우저에서 `?native_handoff=1`을 열어 웹의 계정·기록을 동기화한 뒤 `ottline://open`으로 복귀한다. 네이티브 `2.0.0`에서 이미 새 기록을 작성한 경우 연결 코드로 계정을 병합한다. [Android 전환 및 복구 가이드](../../../docs/android-native-v2-transition.md)

| 버전 | 출시 변경 | 증빙 |
|---|---|---|
| `2.0.0 (24)` | Play 앱을 Bubblewrap TWA에서 네이티브로 전환 | [42550886641](https://github.com/chawon/ott/actions/runs/42550886641) |
| `2.0.1 (25)` | TWA 세션·기록 복구 | [42564729159](https://github.com/chawon/ott/actions/runs/42564729159) |
| `2.0.2 (26)` | Play 인앱 리뷰와 스토어 평가 진입점 | [43023168335](https://github.com/chawon/ott/actions/runs/43023168335) |
| `2.0.3 (27)` | 웹 Play 유입, Install Referrer와 계정 핸드오프 | [43028828768](https://github.com/chawon/ott/actions/runs/43028828768) |
| `2.0.4 (28)` | 빠른 기록의 중복 생성 방지와 기존 중복 정리 | [44111552653](https://github.com/chawon/ott/actions/runs/44111552653) |

## 연결된 기기 표시

API는 기존 `2.0.4` 앱의 `ottline-android/` User-Agent를 인식해 웹에서도 연결 기기를 `Android App · Android`로 표시한다. `main`에는 Android 앱의 `X-Client-Platform: android_native` 전송과 기기 라벨 정렬도 추가됐다. Play에 배포된 `2.0.4`의 소스 SHA와 API 운영 SHA는 각각 `7b373d0`, `38112ca`다. [PR #136](https://github.com/chawon/ott/pull/136)

## 관련 문서

- [ottline v2](../features/ottline-v2.md)
- [TWA 이력](../../archive/twa.md)
- [Web/PWA](pwa.md)
