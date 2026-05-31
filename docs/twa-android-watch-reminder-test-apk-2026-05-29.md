# Android Watch Reminder Test APK

## 목적

테스트 APK에서만 OTT 앱 사용 종료 후 ottline 기록 알림을 띄우는 실험을 검증한다.

## 범위

- 대상 앱: Netflix, TVING, Wavve, Watcha, Coupang Play, Disney+
  - Netflix는 모바일 패키지(`com.netflix.mediaclient`)와 TV 계열 패키지(`com.netflix.ninja`)를 함께 진단한다.
- 감지 방식: Android Usage Access 기반 주기 감지. UsageEvents 이벤트 쌍을 우선 사용하고, 단말에서 이벤트가 비면 앱별 foreground 누적 사용시간 증가분으로 보완한다.
- 알림 동작: 대상 OTT 앱을 10분 이상 사용한 뒤 다른 앱으로 이동하면 기록 알림 후보가 된다.
- 제외: 콘텐츠 제목 감지, Accessibility, Notification Listener, 서버 전송, Play alpha 제출

## 테스트 절차

1. GitHub Actions `Build TWA Debug APK`로 `ottline-watch-reminder-debug.apk`를 생성한다.
2. APK를 설치하고 ottline 설정의 Android 테스트 섹션에서 `시청 기록 알림 테스트`를 연다.
3. 네이티브 설정 화면에서 기능을 켜고 Android 사용 정보 접근 권한과 알림 권한을 허용한다.
4. 이전 테스트에서 다른 OTT 앱 이름이 잘못 떴거나 알림이 안 떴다면 `감지 상태 초기화`를 누른 뒤 다시 시작한다.
5. 대상 OTT 앱을 10분 이상 사용한 뒤 홈 또는 다른 앱으로 이동한다.
6. 최대 15분 안팎의 WorkManager 주기 후 기록 알림이 뜨는지 확인한다.
7. 알림이 안 뜨면 테스트 화면의 `마지막 감지 결과`와 `최근 감지 디버그`를 확인하고, 필요하면 `지금 감지 실행(보류/최근 사용 포함)`으로 보류 후보나 최근 6시간 내 10분 이상 사용 후보를 즉시 알림으로 보낸다.
   - 그래도 후보가 없으면 `최근 감지 디버그`의 `최근 사용 앱`에 실제 Netflix 패키지가 어떤 이름으로 보이는지 확인한다.
   - 수동 감지는 UI 스레드 밖에서 실행하고, 감지 중 예외가 발생하면 앱을 종료하지 않고 `감지 오류: ...` 형태로 화면에 남긴다.
8. 알림을 탭했을 때 QuickLog가 영상 모드로 열리고 플랫폼이 채워지는지 확인한다.

## 제한

- WorkManager 주기는 OS 배터리 정책에 따라 지연될 수 있다.
- 기능을 켠 시점 이전의 앱 사용 기록은 알림 후보에서 제외한다.
- 누적 사용시간 fallback은 Android가 제공하는 앱 단위 foreground 시간만 사용한다. 콘텐츠 제목, 재생 상태, 앱 화면 내용은 읽지 않는다.
- `최근 감지 디버그`는 대상 앱뿐 아니라 최근 사용 앱 상위 목록의 패키지명도 표시한다. 감지 대상 패키지명이 실제 단말과 다를 때 확인하기 위한 debug APK 전용 진단이다.
- 최근 사용 앱 진단은 앱 라벨 조회를 하지 않고 패키지명만 표시한다. Android package visibility 정책 차이로 테스트 화면이 종료되는 일을 피하기 위해서다.
- 테스트 알림은 debug 전용 신규 알림 아이콘을 사용한다.
- 네이티브 테스트 설정 화면은 debug Activity에서 별도 Light theme과 명시적 배경색을 사용한다.
- Debug APK 전용 구현이므로 release/AAB manifest에는 Usage Access 권한과 대상 앱 query를 넣지 않는다.
