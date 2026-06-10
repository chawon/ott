# Android Revisit Reminders

## 목적

Android Google Play TWA 설치본에서 기록을 다시 열어볼 이유를 네이티브 알림으로 만든다.
추천 기능이 아니라 사용자의 기존 기록을 회고, 공유, 이어보기로 다시 여는 기능이다.

## v1 범위

- Android 네이티브 우선 구현이다. Web Push/PWA 구독은 v1 범위가 아니다.
- Android 앱은 설치별 opaque token을 생성해 TWA launch URL에 붙인다.
- 웹은 token을 서버에 bind한 뒤 URL에서 즉시 제거한다. token 원문은 localStorage나 analytics properties에 저장하지 않는다.
- 서버는 token hash만 저장하고 사용자/기기와 연결한다.
- 서버 후보 타입은 `WEEKLY_RECAP`, `MONTHLY_GENRE`, `SEVEN_DAY_GAP`, `SERIES_CONTINUE` 네 가지다.
- Android 네이티브 워커는 하루 주기로 `/api/android/reminders/next`를 호출하고, 후보가 있으면 알림을 띄운다.
- 알림 클릭 시 Android receiver가 `/api/android/reminders/{deliveryId}/opened` ack를 남기고 해당 deep link를 TWA로 연다.

## 트리거 정책

- `MONTHLY_GENRE`: 매월 1일, 지난달 장르 기록이 2회 이상 있을 때 월간 장르 회고를 생성한다.
- `WEEKLY_RECAP`: 매주 월요일, 지난주 기록이 1개 이상 있을 때 주간 회고를 생성한다.
- `SEVEN_DAY_GAP`: 마지막 기록 후 7일 이상 지났을 때 기록 재개 알림을 생성한다.
- `SERIES_CONTINUE`: 최근 2-14일 사이 시리즈 기록 중 `IN_PROGRESS` 또는 시즌/에피소드 정보가 있는 항목을 이어보기 후보로 사용한다.
- 같은 사용자는 하루에 최대 1개 알림만 받는다.
- 같은 period/title/gap 후보는 `android_notification_deliveries.user_id + dedupe_key`로 중복 발송을 막는다.

## 사용자 노출

- Android 네이티브 설정 화면에는 기존 `시청 기록 알림`과 별도로 `회고 리마인드` 토글을 노출한다.
- 알림 권한이 이미 허용된 경우 회고 리마인드는 기본 켜짐으로 동작한다.
- 사용자가 회고 리마인드를 끄면 그 선택을 유지한다.
- 웹 `/me/report`에는 주간 기록, 이번 달 최다 장르, 기록 공백, 시리즈 이어보기 후보를 표시한다.
- `/me/report`에서 주간/월간 묶음 공유카드를 생성할 수 있다.

## 검증

- API: `apps/api`에서 `GRADLE_USER_HOME=./.gradle ./gradlew test --stacktrace`
- Web: `npm run build --workspace ott`
- Biome: `node_modules/@biomejs/cli-linux-arm64/biome check ...`
- Android AAB/APK: 로컬 WSL ARM 환경은 AAPT2/Gradle wrapper 제약이 있으므로 GitHub Actions `Build TWA Release AAB`가 source of truth다.

## 릴리스 상태

- `2026-06-07` production 배포 완료
- PR: `#53`
- BuildConfig hotfix PR: `#54`
- Web/API deploy SHA: `325c60197334578091490c26213b750e542a9e61`
- Hotfix main SHA: `4720fa7a19214ce0d770b4776aaf25bf7a0babec`
- Web/API staging run: `27082422961` / `27082422982`
- Web/API production run: `27082848234` / `27082772693`
- TWA release run: `27083202447`
- Google Play `production`: `1.0.10` (`versionCode=14`), `status=completed`
- Production 확인: ArgoCD `ott-app` `Synced Healthy`, `ott-web`/`ott-api` 이미지 태그 `325c60197334578091490c26213b750e542a9e61`, `APP_VERSION=325c601`
- 후속 수정: `2026-06-10` PR `#58`, main SHA `27bb8941aa703699e32045041b5aa27705dbbdd0`, TWA release run `27256880845`로 Google Play `production` `1.0.12` (`versionCode=16`, `status=completed`) 배포 완료. 회고 리마인드 알림 탭은 `BroadcastReceiver` trampoline 대신 `LauncherActivity`를 직접 여는 `PendingIntent.getActivity()` 경로를 사용한다.
- 남은 확인: 실제 Play 설치본 업데이트 후 token bind, 회고 리마인드 토글, 알림 표시, 알림 탭 이동

## 릴리스 메모

`Adds Android revisit reminders for weekly recaps, monthly genre summaries, record gaps, and series continuation.`

`Fix reminder reliability and ensure recap reminder notifications open ottline.`
