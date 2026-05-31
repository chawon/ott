# Android Watch Reminder Test APK

## 목적

테스트 APK에서만 OTT 앱 사용 종료 후 ottline 기록 알림을 띄우는 실험을 검증한다.

## 범위

- 대상 앱: Netflix, TVING, Wavve, Watcha, Coupang Play, Disney+
  - Netflix는 모바일 패키지(`com.netflix.mediaclient`)와 TV 계열 패키지(`com.netflix.ninja`)를 함께 진단한다.
- 감지 방식: Android Usage Access 기반 주기 감지. 대상 OTT 앱의 UsageStats만 읽고, 자동 감지는 마지막 감지 이후 갱신된 `lastTimeUsed` 또는 foreground 누적 사용시간 증가분을 후보로 삼는다. Debug APK는 WorkManager periodic에 더해 5분 지연 one-shot 감지 체인을 함께 예약한다.
- 알림 동작: 대상 OTT 앱의 마지막 사용 시각이 마지막 감지 이후로 갱신되면 기록 알림 후보가 된다. 기존 global/app cooldown은 유지한다.
- 제외: 콘텐츠 제목 감지, Accessibility, Notification Listener, 서버 전송, Play alpha 제출

## 테스트 절차

1. GitHub Actions `Build TWA Debug APK`로 `ottline-watch-reminder-debug.apk`를 생성한다.
2. APK를 설치하고 ottline 설정의 Android 테스트 섹션에서 `시청 기록 알림 테스트`를 연다.
3. 네이티브 설정 화면에서 기능을 켜고 Android 사용 정보 접근 권한과 알림 권한을 허용한다.
4. 이전 테스트에서 다른 OTT 앱 이름이 잘못 떴거나 알림이 안 떴다면 `감지 상태 초기화`를 누른 뒤 다시 시작한다.
5. 대상 OTT 앱을 사용한 뒤 홈 또는 다른 앱으로 이동한다.
6. 5분 안팎의 one-shot 감지 또는 최대 15분 안팎의 WorkManager periodic 주기 후 기록 알림이 뜨는지 확인한다.
7. 알림이 안 뜨면 테스트 화면의 `마지막 감지 결과`와 `최근 감지 디버그`를 확인하고, 필요하면 `지금 감지 실행(보류/마지막 사용 포함)`으로 보류 후보나 최근 6시간 내 마지막 사용 후보를 즉시 알림으로 보낸다.
   - 자동/수동 감지는 대상 OTT 앱의 UsageStats만 읽는다. 이벤트 조회와 전체 최근 앱 조회는 StackOverflow 회피를 위해 생략한다.
   - 수동 감지는 UI 스레드 밖에서 실행하고, 감지/화면 표시 중 예외가 발생하면 앱을 종료하지 않고 `감지 오류: ...`, `수동 감지 오류: ...`, `화면 표시 오류: ...` 형태로 화면에 남긴다.
8. 알림을 탭했을 때 QuickLog가 영상 모드로 열리고 플랫폼이 채워지는지 확인한다.

## 제한

- WorkManager one-shot/periodic은 OS 배터리 정책에 따라 지연될 수 있다.
- 기능을 켠 시점 이전의 앱 사용 기록은 알림 후보에서 제외한다.
- 감지는 Android가 제공하는 앱 단위 마지막 사용 시각과 foreground 시간만 사용한다. 콘텐츠 제목, 재생 상태, 앱 화면 내용은 읽지 않는다.
- `최근 감지 디버그`는 대상 OTT 앱별 누적 사용시간 증가분과 마지막 사용 시각을 표시한다. 수동 감지에서는 마지막 사용 시각만 보여도 후보로 올려 알림/QuickLog 진입을 검증한다.
- 테스트 알림은 debug 전용 신규 알림 아이콘을 사용한다.
- 네이티브 테스트 설정 화면은 debug Activity에서 별도 Light theme과 명시적 배경색을 사용한다.
- Debug APK 전용 구현이므로 release/AAB manifest에는 Usage Access 권한과 대상 앱 query를 넣지 않는다.
