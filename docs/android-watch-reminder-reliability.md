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

- PR `#122`, main SHA `a294cbf7e3accee3626970bf21e604ccf8639df5`로 알림 수정을 병합했다. Android CI run `40168129880`에서 감지 흐름 22건, 단위 테스트 및 debug APK 빌드가 통과했다.
- PR `#123`으로 API 24 호환 요건을 반영한 source SHA `2bbff18256dffd7078e61fbfe44c2a23433d3031`을 release run `40169071221`로 배포했다. 새 Play 조회 세션에서 production `1.0.19`/`23`/`completed`, 전체 배포 등록을 확인했다.
- 첫 production release run `40168623901`의 업로드 거부는 아래 API 24 변경으로 해소했다. 실제 기기의 알림 수신과 스토어 업데이트 노출은 아직 직접 확인하지 않았다.

## Play 자동 보호 호환 요건 결정

- Play 업로드 오류: `Play automatic protection requires a minimum SDK version of 24 or higher`이며 기존 앱은 `minSdk=23`이었다.
- `2026-10-25` 사용자가 권장안인 Android 7.0(API 24) 이상 지원으로 변경하고 배포하는 방안을 승인했다.
- 적용: `apps/twa/app/build.gradle`의 `minSdk`와 `apps/twa/twa-manifest.json`의 `minSdkVersion`을 `24`로 맞췄다. 자동 보호를 유지하며 Android 6.0(API 23)은 새 업데이트 대상에서 제외한다.
- 검증: PR `#123` CI run `40168892187`의 감지 회귀 테스트·Android 단위 테스트·APK 빌드와 production run `40169071221`의 릴리스 빌드 및 Play 등록을 통과했다.
- 근거: [Google Play 자동 보호 요건](https://support.google.com/googleplay/android-developer/answer/10183279?hl=en-GB).

## 배포 확인 (2026-10-25)

| 항목 | 확인값 |
|---|---|
| 소스 | `2bbff18256dffd7078e61fbfe44c2a23433d3031` (PR `#122`·`#123` 병합) |
| 릴리스 | [GitHub Actions 40169071221](https://github.com/chawon/ott/actions/runs/40169071221), 모든 단계 성공 |
| Google Play | production `1.0.19`, `versionCode=23`, `status=completed`, 전체 배포 |
| 별도 조회 세션 | `09339353177853118628` |
| 서명 AAB SHA-256 | `6bf3b47dc4a0964ef062f534e61cf9eefdb20662fe0ee312cdf1b9561d73ddcb` |
| 파일 일치 | CI artifact `ottline-release-aab`를 내려받아 Play bundles API의 versionCode 23 해시와 대조해 일치 확인 |
| 후속 | 실제 기기 업데이트·알림 표시·QuickLog 진입 확인 |

기존 beta `1.0.18 (22)`, alpha `1.0.9 (13)`, internal `1.0.14 (18)`은 유지했다. 다음 업로드는 `versionCode >= 24`를 사용한다.

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
- 사용시간/초기화 단위 테스트 17건과 실제 Worker를 실행하는 22개 감지 시나리오가 통과했다. API 24 변경 후 CI `40168892187`에서도 단위 테스트와 감지 시나리오, APK 빌드를 다시 통과했다.
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
