# Android Watch Reminder Alpha

## 목적

Google Play TWA 앱 안에서 OTT 앱 사용 종료 후 ottline 기록 알림을 띄우는 알파 기능을 검증한다.

## 범위

- 대상 앱: Netflix, TVING, Wavve, Watcha, Coupang Play, Disney+, Prime Video
  - Netflix는 모바일 패키지(`com.netflix.mediaclient`)와 TV 계열 패키지(`com.netflix.ninja`)를 함께 진단한다.
  - Prime Video는 Google Play 패키지(`com.amazon.avod.thirdpartyclient`)를 진단한다.
- 감지 방식: Android Usage Access 기반 주기 감지. 대상 OTT 앱의 UsageStats만 읽고, 자동 감지는 5분 이상 foreground 사용시간 증가분이 있으며 마지막 사용이 15분 이내인 앱만 후보로 삼는다. WorkManager periodic에 더해 5분 지연 one-shot 감지 체인을 함께 예약한다.
- 알림 동작: 대상 OTT 앱을 의미 있게 사용한 것으로 보이면 기록 알림 후보가 된다. 기존 global/app cooldown은 유지한다.
- 제외: 콘텐츠 제목 감지, Accessibility, Notification Listener, 서버 전송

## 테스트 절차

1. GitHub Actions `Build TWA Debug APK`로 `ottline-watch-reminder-debug.apk`를 생성하거나 Google Play alpha 빌드를 설치한다.
2. ottline 설정의 Android 테스트 섹션에서 `시청 기록 알림 설정`을 연다.
3. 네이티브 설정 화면에서 기능을 켜고 Android 사용 정보 접근 권한과 알림 권한을 허용한다.
4. Debug APK에서 이전 테스트의 보류 후보가 남아 있다면 `감지 상태 초기화`를 누른 뒤 다시 시작한다.
5. 대상 OTT 앱을 5분 이상 사용한 뒤 홈 또는 다른 앱으로 이동한다.
6. 5분 안팎의 one-shot 감지 또는 최대 15분 안팎의 WorkManager periodic 주기 후 기록 알림이 뜨는지 확인한다.
7. Debug APK에서 알림이 안 뜨면 테스트 화면의 `마지막 감지 결과`와 `최근 감지 디버그`를 확인하고, 필요하면 `지금 감지 실행(보류/마지막 사용 포함)`으로 보류 후보나 최근 6시간 내 마지막 사용 후보를 즉시 알림으로 보낸다.
   - 자동/수동 감지는 대상 OTT 앱의 UsageStats만 읽는다. 이벤트 조회와 전체 최근 앱 조회는 StackOverflow 회피를 위해 생략한다.
   - 자동 알림은 짧게 앱만 켠 경우를 줄이기 위해 foreground 증가분 5분 이상 조건을 적용한다. 수동 감지는 알파 진단용으로 마지막 사용 후보까지 허용한다.
   - 수동 감지는 UI 스레드 밖에서 실행하고, 감지/화면 표시 중 예외가 발생하면 앱을 종료하지 않고 `감지 오류: ...`, `수동 감지 오류: ...`, `화면 표시 오류: ...` 형태로 화면에 남긴다.
8. 알림을 탭했을 때 QuickLog가 영상 모드로 열리고 플랫폼이 채워지는지 확인한다.

## 제한

- WorkManager one-shot/periodic은 OS 배터리 정책에 따라 지연될 수 있다.
- 기능을 켠 시점 이전의 앱 사용 기록은 알림 후보에서 제외한다.
- 자동 알림은 마지막 사용 후 15분이 넘으면 보내지 않는다.
- 감지는 Android가 제공하는 앱 단위 마지막 사용 시각과 foreground 시간만 사용한다. 콘텐츠 제목, 재생 상태, 앱 화면 내용은 읽지 않는다.
- `최근 감지 디버그`는 대상 OTT 앱별 누적 사용시간 증가분과 마지막 사용 시각을 표시한다. 수동 감지에서는 마지막 사용 시각만 보여도 후보로 올려 알림/QuickLog 진입을 검증한다.
- 알림 문구는 실제 재생을 단정하지 않고, `OTT에서 본 작품이 있나요?`처럼 기록 유도 톤을 사용한다.
- 알림은 ottline 신규 알림 아이콘을 사용한다.
- 네이티브 설정 화면은 별도 Light theme과 명시적 배경색을 사용한다.
- release/AAB manifest에도 Usage Access 권한 선언과 대상 앱 query를 포함한다. Usage Access 실제 허용은 사용자가 Android 설정에서 직접 켜야 한다.
- release/AAB 설정 화면은 사용 정보 접근, 알림 권한, 알림 켜기 순서의 3단계 카드와 필요한 다음 액션만 노출하고 감지 결과/수동 감지/대상 패키지 목록 같은 진단 UI는 숨긴다.
- debug 빌드는 같은 설정 화면을 앱 런처에서도 바로 열 수 있도록 추가 launcher intent를 붙이고 진단 UI를 켠다.

## 확인 결과

- `2026-05-31` Google Play alpha `1.0.8` (`versionCode=12`)로 배포했다.
- Web production `e6b5cfa` 배포 후 Google Play TWA 설치본에서 `시청 기록 알림 설정` 진입 버튼 노출을 확인했다.
- 테스터 단말에서 권한 설정 화면, OTT 사용 후 알림 발송, 알림 탭 시 ottline 기록 화면 이동을 확인했다.
