# ottline Android 개발 및 배포

`apps/android-native`는 Google Play `app.ottline`의 Kotlin · Jetpack Compose 앱이다. [Android 플랫폼 Wiki](../../wiki/pages/platforms/android-native.md)에서 스토어 배포 버전과 코드 상태를 확인한다.

## 소스 안내

- [LauncherActivity.kt](app/src/main/java/app/ottline/LauncherActivity.kt)와 [OttlineAppRoot.kt](app/src/main/java/app/ottline/ui/OttlineAppRoot.kt)가 앱 시작, 위젯·공유 진입, 딥링크, 화면 전환을 처리한다.
- [QuickRecordDialog.kt](app/src/main/java/app/ottline/ui/screens/QuickRecordDialog.kt)에서 작품 선택, 상태 저장, 장소·상황·메모 등의 보완을 처리한다.
- [OttlineRepository.kt](app/src/main/java/app/ottline/data/OttlineRepository.kt)는 Room의 로그와 outbox를 관리한다. WorkManager가 연결 복구 시 기록을 동기화한다.
- 기존 Bubblewrap TWA 사용자가 업데이트할 때 설치 토큰으로 서버 세션을 복구하거나 기존 브라우저에서 웹 기록을 이어받는다. 관련 컴포넌트와 브라우저 경로는 [Android 전환·복구 가이드](../../docs/android-native-v2-transition.md)를 참고한다.

## 로컬 실행과 검증

JDK 17과 Android SDK 36을 준비한다. 이 디렉터리에서 실행한다.

```bash
./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n app.ottline.dev/app.ottline.LauncherActivity
```

Windows PowerShell에서는 `gradlew.bat`를 사용한다. Debug의 기본 패키지명은 `app.ottline.dev`라 기존 Play 앱과 함께 설치할 수 있다. Debug에서 `-PdebugApiBaseUrl=...`로 빌드 기본값을 바꾸거나 앱의 내 공간에서 API 서버를 전환한다. 에뮬레이터는 `http://10.0.2.2:8080`으로 호스트 API에 접근할 수 있다. USB 연결 기기에서는 `adb reverse tcp:8080 tcp:8080` 후 `http://127.0.0.1:8080`을 사용한다. Release는 `https://ottline.app`에 연결한다.

## Google Play 배포

- 로컬에서 서명할 때는 [keystore.properties.example](keystore.properties.example)을 참고한다. 키스토어와 `keystore.properties`를 Git에 올리지 않는다. `./gradlew :app:bundleRelease` 후 `bash ./scripts/verify-release-aab.sh`로 번들을 검증한다. PowerShell에서는 `scripts/verify-release-aab.ps1`을 사용한다.
- [Android 빌드·릴리스 워크플로](../../.github/workflows/native-android-release.yml)는 선택한 리비전에서 단위 테스트, Lint, 서명 AAB 빌드, DEX/R8 시작 계약 검증, 지정 Play 트랙 업로드를 수행한다. `track=none`은 서명 AAB만 만든다.
- 새 배포에는 Play의 최신 `versionCode`보다 큰 번호와 해당 `versionName`을 명시한다. 기존 사용자 이전에 필요한 패키지명, 서명, 위젯·알림 컴포넌트의 호환을 유지한다.
- 배포 후 Play 트랙 상태, 설치된 버전, 기존 설치에서의 업데이트 결과를 각각 확인한다.
