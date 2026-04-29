# TWA Android Entrypoints Update

## 목적
- Android 비공개 테스트 중인 TWA 빌드에 Android 전용 진입면을 보강한다.
- 웹앱의 기록 흐름은 유지하고, 런처/공유/위젯에서 바로 QuickLog로 들어가는 경로를 명확히 한다.

## 배포 상태
- 2026-04-29 `alpha` 트랙 배포 완료
- 버전: `1.0.4` (`versionCode=8`)
- GitHub Actions Run: `25090236209`

## 범위
- 대상: `apps/twa`, `apps/web/app/manifest.ts`, `apps/web/app/[locale]/page.tsx`
- 영향: Android launcher shortcuts, TWA/Web Share Target, Android home widget
- 비영향: API, DB, Sync, 계정/권한 정책

## 변경 방향
1. 런처 롱프레스 shortcuts를 추가한다.
   - `기록하기`: `/?quick=1&quick_focus=1`
   - `영상 기록`: `/?quick=1&quick_type=video&quick_focus=1`
   - `책 기록`: `/?quick=1&quick_type=book&quick_focus=1`
   - `타임라인`: `/timeline`
2. Web Share Target 계약을 명시한다.
   - PWA manifest에 `share_target`을 추가한다.
   - TWA manifest metadata에 `METADATA_SHARE_TARGET`을 추가한다.
   - 기존 `shared_text`, `shared_subject`에 더해 manifest 기반 URL 공유의 `shared_url`도 홈에서 처리한다.
3. Android 홈 화면 위젯은 기록 액션을 `영상`/`책`으로 분리하고 `타임라인` 진입은 유지한다.

## 검증 시나리오
1. Android launcher에서 앱을 길게 눌렀을 때 네 shortcut이 표시되고 각 URL로 진입한다.
2. 외부 앱에서 텍스트/URL을 ottline으로 공유하면 QuickLog 검색어가 프리필된다.
3. 홈 위젯에서 `영상`, `책`, `타임라인`을 눌렀을 때 각각 영상 QuickLog, 책 QuickLog, 타임라인으로 진입한다.
4. TWA release AAB 빌드에서 `shortcuts.xml`, widget layout, AndroidManifest 리소스 참조가 깨지지 않는다.
