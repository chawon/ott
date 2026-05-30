# Android Watch Reminder Test APK

## 목적

테스트 APK에서만 OTT 앱 사용 종료 후 ottline 기록 알림을 띄우는 실험을 검증한다.

## 범위

- 대상 앱: Netflix, TVING, Wavve, Watcha, Coupang Play, Disney+
- 감지 방식: Android Usage Access 기반 주기 감지
- 알림 동작: 대상 OTT 앱을 10분 이상 사용한 뒤 다른 앱으로 이동하면 기록 알림 후보가 된다.
- 제외: 콘텐츠 제목 감지, Accessibility, Notification Listener, 서버 전송, Play alpha 제출

## 테스트 절차

1. GitHub Actions `Build TWA Debug APK`로 `ottline-watch-reminder-debug.apk`를 생성한다.
2. APK를 설치하고 ottline 설정의 Android 테스트 섹션에서 `시청 기록 알림 테스트`를 연다.
3. 네이티브 설정 화면에서 기능을 켜고 Android 사용 정보 접근 권한과 알림 권한을 허용한다.
4. 이전 테스트에서 다른 OTT 앱 이름이 잘못 떴거나 알림이 안 떴다면 `감지 상태 초기화`를 누른 뒤 다시 시작한다.
5. 대상 OTT 앱을 10분 이상 사용한 뒤 홈 또는 다른 앱으로 이동한다.
6. 최대 15분 안팎의 WorkManager 주기 후 기록 알림이 뜨는지 확인한다.
7. 알림이 안 뜨면 테스트 화면의 `마지막 감지 결과`를 확인하고, 필요하면 `지금 감지 실행(cooldown 무시)`으로 보류된 후보를 즉시 알림으로 보낸다.
8. 알림을 탭했을 때 QuickLog가 영상 모드로 열리고 플랫폼이 채워지는지 확인한다.

## 제한

- WorkManager 주기는 OS 배터리 정책에 따라 지연될 수 있다.
- 기능을 켠 시점 이전의 앱 사용 기록은 알림 후보에서 제외한다.
- 테스트 알림은 debug 전용 신규 알림 아이콘을 사용한다.
- Debug APK 전용 구현이므로 release/AAB manifest에는 Usage Access 권한과 대상 앱 query를 넣지 않는다.
