# Android 시청 기록 알림 감지 점검

## 증상과 범위

- 신고: OTT 앱을 이용한 뒤 Android ottline 시청 기록 알림이 최근 나타나지 않는다.
- 대상: `apps/twa`의 사용 정보 조회, 사용시간 기준, 알림 후보 및 예약 복구 경로.
- 기기 모델, OS 버전, 대상 OTT 및 권한 상태는 사용자 확인 대기 중이다. 현재 ADB에 연결된 기기는 없다.
- API, DB, 동기화 계약 변경은 계획하지 않는다.

## 검증 및 개발 방향

1. 실제 `WatchReminderWorker`를 실행하는 격리된 재현 환경으로 알림 발생 여부를 확인한다.
2. 정상 5분 이상 시청, 여러 감지 주기에 걸친 시청, 날짜 전환 후 시청, 짧은 사용 및 기존 cooldown을 구분한다.
3. 재현된 문제에 한해 최소 수정하고, Android SDK 없이도 실행 가능한 사용시간 판단 회귀 테스트를 남긴다.
4. 단위 테스트와 가능한 빌드 검증을 수행한다. 실제 기기의 권한, 배터리 정책, 알림 표시 결과는 별도 실기기 검증으로 구분한다.

## 상태

- `fix/android-watch-reminder`에서 수정 및 검증 중이며 배포하지 않았다.

## 재현된 코드 문제

1. 감지할 때마다 기준 사용시간을 덮어써서, 한 번의 증가분이 5분 미만이면 총 6분을 사용해도 후보가 되지 않았다. 주기 작업과 one-shot이 각각 실행될 때 사용시간이 분할될 수 있다.
2. `INTERVAL_DAILY` 누적시간을 날짜 식별자 없이 비교해 전날 120분보다 적은 새 날짜 10분 사용을 놓쳤다. 통계 구간도 마지막 사용 시각 대신 `getFirstTimeStamp()`로 선택해야 한다.
3. 통계 조회가 null/빈 목록일 때 기준을 0으로 덮어쓰던 처리는 기존 사용시간을 새 시청으로 다시 계산할 수 있었다.
4. 후보 생성 뒤 알림 서비스 예외가 나면 이미 갱신된 기준 때문에 동일 시청을 재시도하지 못했다.

위 항목은 제어한 UsageStats 입력으로 실제 Worker를 실행해 확인했다. 사용자 기기의 직접 원인이라는 확정은 기기 정보/로그가 있어야 가능하다.

## 수정

- `WatchReminderUsageTracker`가 앱별 일별 통계 구간, 누적 사용시간, 아직 알리지 않은 증가분 및 마지막 사용 시각을 관리한다.
- 여러 감지 주기의 새 사용시간을 합쳐 5분 이상이면 후보를 만든다. 2시간보다 오래된 증가분은 합산하지 않는다.
- 날짜가 바뀌면 새 구간의 누적시간으로 증가분을 계산하고, 조회가 일시적으로 비면 기존 기준을 유지한다.
- 소비한 사용시간과 보류 후보를 함께 저장한 후 알림을 시도한다. 성공하면 보류 후보를 지우며 권한/서비스 실패 시 다음 감지에서 재시도한다.
- 기능을 처음 켤 때와 명시적으로 감지 상태를 초기화할 때는 현재 통계를 기준으로 잡는다. 이전 버전에서 업데이트하면 새 구간 키가 없는 앱의 첫 감지를 기준으로 삼고 이후 증가분부터 계산한다. 기존 켜짐 설정과 cooldown은 업데이트만으로 초기화하지 않는다.
- 기존 전체 3시간/앱별 24시간 cooldown과 Usage Access 방식은 유지한다.

## 검증

- `python3 apps/twa/scripts/test-watch-reminder-worker.py`: JDK 17 이상과 Python 3만으로 실제 Worker/Scheduler/Targets/Tracker를 컴파일·실행한다. Android API는 메모리 기반 test double이며 OS 실행 정책이나 실제 알림 UI를 검증하지 않는다.
- `:app:testDebugUnitTest`: 사용시간 추적 회귀 테스트와 기존 시작 초기화 테스트.
- PR의 `Build TWA Debug APK`에서 위 검증과 debug APK 빌드를 함께 실행한다.
- 첫 CI run `40168056497`은 테스트 실행 전 SDK 설치 단계에서 기존 기본 패키지 `tools`를 찾지 못해 실패했다. Debug/Release/수동 AAB 워크플로우에 실제 사용하는 Android 36 platform/build-tools와 platform-tools를 명시했다.
- 로컬 Gradle 테스트는 SDK `build-tools;36.0.0`/`platforms;android-36` 및 해당 라이선스 부재로 실행되지 않았다. Android SDK가 필요 없는 JDK/JUnit 경로에서 단위 테스트를 실행했다.
- 루트 `npm run test`는 저장소에 해당 스크립트가 없어 실행할 수 없다. 이번 변경은 TWA 전용 검증을 사용한다.

## 실기기 확인 항목

1. 시청 기록 알림 켜짐, 사용 정보 접근 허용, 앱 알림/시청 알림 채널 허용 상태를 확인한다.
2. OTT 앱을 5분 이상 사용한 뒤 다른 앱으로 이동하고 주기 작업 후 알림 표시와 플랫폼이 채워진 QuickLog 진입을 확인한다.
3. 다음 날 반복 시청, 재부팅/앱 업데이트 이후 동작 및 기기별 배터리 제한 상태를 확인한다.
4. WorkManager는 OS 정책으로 지연될 수 있어 정확한 5분 전달을 보장하지 않는다. 사용자 기기는 현재 연결되지 않아 이 검증은 아직 수행하지 않았다.

일별 구간과 잠금 시 null 반환 계약은 [Android UsageStatsManager 문서](https://developer.android.com/reference/android/app/usage/UsageStatsManager#queryUsageStats(int,%20long,%20long)), 구간 시작 시각은 [UsageStats 문서](https://developer.android.com/reference/android/app/usage/UsageStats#getFirstTimeStamp())를 따른다.
