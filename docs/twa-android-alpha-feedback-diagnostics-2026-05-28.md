# Android Alpha Feedback Diagnostics Update

## 목적
- Google Play production access 재신청 전, Android closed-test 피드백에 앱 버전과 진입 맥락을 자동으로 남긴다.
- 테스터가 남긴 의견을 Play 재신청 답변의 "feedback collected"와 "changes made during testing" 근거로 정리하기 쉽게 한다.

## 배포 후보
- 버전: `1.0.7`
- versionCode: `11`
- 대상 트랙: Google Play `alpha`
- 배포 워크플로우: `.github/workflows/twa-release.yml`

## 범위
- 대상:
  - `apps/twa/app/build.gradle`
  - `apps/twa/app/src/main/res/xml/shortcuts.xml`
  - `apps/web/components/AndroidAppContextRecorder.tsx`
  - `apps/web/components/FeedbackInbox.tsx`
  - `apps/web/lib/androidAppContext.ts`
  - `apps/web/app/[locale]/feedback/page.tsx`
  - `apps/web/app/[locale]/account/page.tsx`
  - `apps/web/app/[locale]/page.tsx`
  - `apps/web/messages/{ko,en}.json`
- 영향:
  - Android TWA 시작 URL과 launcher shortcuts에 `android_app_version`, `android_app_version_code`를 붙여 웹에 전달한다.
  - 웹은 전달받은 Android 앱 버전 맥락을 로컬에 저장한다.
  - `/feedback?source=android-alpha`와 `/feedback?source=android-alpha-share` 본문에 진단 정보를 자동으로 붙인다.
- 비영향:
  - API, DB, Sync 계약
  - 일반 웹/PWA/Toss 세션의 Android 테스트 섹션 노출 조건
  - 사용자 공개 화면

## 자동 입력 진단 정보
- 문의 출처
- Android 앱 버전과 versionCode
- 앱 진입 경로
- 현재 경로
- 공유 진입 의견 여부
- 표시 모드
- 언어
- User-Agent
- 작성 시각

## Play alpha 입력값
```text
version_code: 11
version_name: 1.0.7
track: alpha
release_status: completed
rollout: 1.0
release_notes: Improved Android closed-test feedback diagnostics. Testers can now send feedback with app version, entry path, locale, display mode, and device context attached for widget, shortcut, sharing, and logging checks.
```

## 검증 시나리오
1. `/?android_app_version=1.0.7&android_app_version_code=11`로 진입하면 Android 앱 버전 맥락이 로컬에 저장된다.
2. `/feedback?source=android-alpha&from=account` 진입 시 Android 테스트 의견 본문에 진단 정보가 자동으로 붙는다.
3. `/feedback?source=android-alpha-share&from=home` 진입 시 공유 진입 의견이 `예`로 표시된다.
4. `/feedback` 일반 진입 시 진단 정보가 붙지 않는다.
5. TWA release AAB 빌드에서 launch URL과 shortcuts URL에 release 입력값 기반 versionName/versionCode가 반영된다.
