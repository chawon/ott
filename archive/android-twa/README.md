# Android TWA 소스 보관

Google Play `app.ottline`의 Bubblewrap 프로젝트입니다. 마지막 TWA 릴리스는 `1.0.19` (`versionCode=23`)이고, `2026-11-09`부터 [Android Native](../../apps/android-native/README.md)가 같은 패키지의 배포를 이어받았습니다. [v2 전환 기록](../../docs/android-native-v2-transition.md)과 [TWA 운영 기록](../../wiki/archive/twa.md)을 함께 참고합니다.

- 소스와 Gradle 래퍼는 이전 설치 재현에 사용합니다. 오래된 Play 배포 정의 3개는 [workflows](workflows/)에 당시 `apps/twa` 경로 그대로 보존했습니다. 이 경로의 YAML은 GitHub Actions에서 실행되지 않습니다.
- 기존 TWA 설치에서 넘어오는 세션·기록 복구는 활성 Web·API·Android Native에서 유지합니다. Android Native 배포는 기존 `TWA_KEYSTORE_*` 서명 시크릿을 계속 사용합니다.
- 마지막 운영 버전의 소스와 기존 Actions 경로가 함께 필요한 경우 커밋 `2bbff18256dffd7078e61fbfe44c2a23433d3031`을 별도 checkout에서 확인합니다. 해당 커밋의 Play 배포는 release run `40169071221`에 기록되어 있습니다.

## 로컬 회귀 테스트

저장소 루트에서 JDK 17 이상과 Python 3을 사용합니다.

```sh
python3 archive/android-twa/scripts/test-watch-reminder-worker.py
```

사용 시간과 알림 판단을 가짜 Android API로 검증합니다. 실제 운영체제의 백그라운드 실행 및 알림 수신은 실기기 검증 범위입니다.
