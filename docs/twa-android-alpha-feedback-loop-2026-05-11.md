# Android Alpha Feedback Loop Update

## 목적
- Google Play 프로덕션 액세스 재신청 전, 실제 테스터가 앱 안에서 의견을 남기고 운영자가 조치 이력을 남길 수 있게 한다.
- Android 비공개 테스트 중 확인해야 할 위젯, 런처 shortcuts, 공유 기록 흐름을 설정 화면에서 명확히 안내한다.
- OTT 앱 공유가 성공/실패했을 때 QuickLog에서 상태를 보여주고, 실패 사례를 바로 문의함으로 보낼 수 있게 한다.

## 배포 상태
- 버전: `1.0.5`
- versionCode: `9`
- 대상 트랙: Google Play `alpha`
- 배포 워크플로우: `.github/workflows/twa-release.yml`
- Web production deploy run: `25656621482`
- TWA release run: `25656711609`
- Google Play `alpha`: `1.0.5` (`versionCode=9`), `status=completed`
- Google Play `production`: 게시된 릴리즈 없음

## 범위
- 대상:
  - `apps/web/app/[locale]/account/page.tsx`
  - `apps/web/app/[locale]/feedback/page.tsx`
  - `apps/web/app/[locale]/page.tsx`
  - `apps/web/components/FeedbackInbox.tsx`
  - `apps/web/components/QuickLogCard.tsx`
  - `apps/web/messages/{ko,en}.json`
  - `.github/workflows/twa-release.yml`
- 영향:
  - Google Play TWA 세션에서만 보이는 설정 화면 Android 테스트 체크리스트와 피드백 CTA
  - 문의함 URL preset (`/feedback?source=android-alpha`, `/feedback?source=android-alpha-share`)
  - 공유 진입 QuickLog 상태 배너
  - Play alpha release notes 입력
- 비영향:
  - API, DB, Sync 계약
  - Android native resource, widget, shortcut URL 계약

## 변경 사항
1. Google Play TWA 세션에서만 설정 화면에 `Android 테스트 의견` 섹션을 추가한다.
   - 홈 화면 위젯
   - 앱 아이콘 롱프레스 shortcut
   - OTT 앱 공유로 QuickLog 검색 프리필
   - 문의함 등록
2. 문의함은 URL preset을 받으면 카테고리, 제목, 본문 템플릿을 자동 채운다.
   - `/feedback?source=android-alpha`: 일반 Android 테스트 의견
   - `/feedback?source=android-alpha-share`: 공유 기록 실패/개선 의견
3. 홈 QuickLog는 공유 진입 상태를 표시한다.
   - 제목 추출 성공: 공유에서 가져온 제목임을 안내
   - 제목 추출 실패: 직접 검색 안내와 공유 기록 의견 보내기 링크 제공
4. `twa-release.yml`에 `release_notes` 입력을 추가한다.
   - `gplay release --release-notes`로 Play alpha 릴리스 노트를 함께 남긴다.

## Play alpha 입력값
```text
version_code: 9
version_name: 1.0.5
track: alpha
release_status: completed
rollout: 1.0
release_notes: Android closed-test feedback flow added. Testers can now send Android test feedback from Settings, use a prefilled feedback template, and report shared logging issues directly from QuickLog.
```

## 검증 시나리오
1. Google Play TWA 세션에서 설정 화면의 Android 테스트 체크리스트와 `Android 테스트 의견 보내기` 버튼이 모바일 폭에서 깨지지 않는다.
2. 일반 웹, Windows PWA, Toss WebView 세션에서는 설정 화면의 Android 테스트 섹션이 보이지 않는다.
3. `/feedback?source=android-alpha` 진입 시 제목/본문 템플릿이 채워지고 문의 등록이 가능하다.
4. `/feedback?source=android-alpha-share` 진입 시 공유 기록 테스트 템플릿이 채워진다.
5. `/?quick=1&shared_text=...` 진입 시 QuickLog 검색창이 채워지고 공유 성공 배너가 표시된다.
6. 자동 추출이 불가능한 공유 입력에서는 직접 검색 안내와 공유 기록 의견 링크가 표시된다.
7. `twa-release.yml` 수동 실행 시 release notes 입력을 `gplay release`에 전달한다.
