# TWA 내부 테스트 가이드

## 목표
- PWA를 Android TWA로 패키징해 내부 테스트용 APK 생성
- 실제 배포 전, 기본 설치/실행/딥링크/스탠드얼론 동작 확인

## 진행 상황
- GitHub Actions에서 디버그 APK 빌드 성공 및 기기 설치 확인 완료
- 현재 개발 환경(WSL on ARM Linux)에서는 Android Gradle 로컬 빌드 호환 이슈가 있어, APK/AAB 빌드는 GitHub Actions를 기본 경로로 사용

### 진행 업데이트 (2026-02-15)
- TWA 공유 인텐트 MVP 반영 완료 (main 머지)
  - Android `LauncherActivity`에서 공유 텍스트(`EXTRA_TEXT`, `EXTRA_SUBJECT`) 수신
  - 런치 URL 쿼리(`shared_text`, `shared_subject`)로 웹 앱에 전달
  - 홈 `작품 검색` 입력창 자동 프리필로 빠른 기록 시작
- 공유 텍스트 파서(`apps/web/lib/shareIntent.ts`) 추가
  - 인용부호/플랫폼 문구/URL 혼합 텍스트에서 작품명 우선 추출
  - 넷플릭스, 디즈니+, 프라임 비디오, 애플 TV, 티빙 URL 패턴 대응
  - 저신뢰 홍보문구(예: 쿠팡플레이 app.link 단독 공유) 오탐 방지

### 진행 업데이트 (2026-02-16)
- 공유 파싱/검색 정확도 보강
  - 프라임 비디오: `작품명 - 시즌 N` 공유문구에서 시즌 제거, 작품명만 검색
  - 티빙: `작품명 N화 | TVING` 형태에서 회차/플랫폼 꼬리 제거
  - 쿠팡플레이: app.link 단축 URL에 대해 웹 폴백 재시도 후 제목 추출
- 서버 리졸버 추가
  - `apps/web/app/share-resolve/route.ts`
  - allowlist 도메인만 HTML 메타(`og:title`, `twitter:title`, `title`) 파싱
  - Chrome 모바일 UA/헤더 적용 + branch 링크 재시도(`$web_only=true`)
- 플랫폼 자동 세팅
  - 공유 소스 기준 `플랫폼` 필드를 자동 매핑해 기록 입력 부담 감소
  - 매핑: 넷플릭스, 디즈니플러스, 애플티비, 프라임비디오, 티빙, 쿠팡플레이, 왓챠
- 전환 UX 안정화
  - 초기 테마 클래스 선적용으로 다크/라이트 플래시 완화
  - 홈에서 메뉴 이동 시 좌우 흔들림 완화(`overflow-x` 차단, 전환 스타일 축소)

### 진행 업데이트 (2026-02-17)
- 모바일 스와이프 메뉴 이동 시험 적용
  - `SwipeNav` 컴포넌트 추가 및 전역 연결
  - 대상 메뉴: 기록하기(`/`) ↔ 타임라인(`/timeline`) ↔ 함께(`/public`) ↔ 설정(`/account`)
  - 엣지 제스처(시스템 백) 및 입력 요소 터치 충돌 회피 처리
- 함께 기록 시즌 메타 정합성 보정
  - 시즌 포스터를 쓰는 항목은 `연도`도 시즌 연도로 응답하도록 API 수정
  - `discussions` 응답에서 제목 연도 대신 최신 시즌 연도 우선 반영

### 진행 업데이트 (2026-02-18)
- Android 홈 화면 위젯 MVP 추가 (`빠른 기록`)
  - 위치: `apps/twa/app/src/main/java/kr/pe/preview/ott/twa/QuickLogWidgetProvider.java`
  - 액션: `영상`, `책`, `타임라인`
  - 동작: 위젯 버튼 탭 시 TWA 실행 후 웹 딥링크 파라미터 전달
- TWA 런처 URL 라우팅 확장
  - `LauncherActivity`에서 `quick_type` 처리
  - `video/book`은 `/?quick=1&quick_type=...&quick_focus=1`로 진입
  - `timeline`은 `/timeline`으로 직접 이동
- 웹 빠른 진입 처리
  - 홈(`apps/web/app/page.tsx`)에서 `quick/quick_type/quick_focus` 파싱
  - 빠른 기록 카드 자동 오픈 + 타입 자동 선택 + 검색창 오토포커스

## 필수 입력 값
- 도메인: https://ott.preview.pe.kr
- 패키지명: kr.pe.preview.ott.twa
- 앱명: On the Timeline (OTT)

## 사전 요구사항
- JDK 17
- Android SDK (platform tools, build tools)
- Node.js

## 빌드 방식 안내 (중요)
- `bubblewrap init`으로 프로젝트 생성/갱신은 가능
- 하지만 WSL의 ARM Linux 환경에서는 Android 빌드 도구 호환 문제로 `./gradlew assembleDebug`, `./gradlew bundleRelease` 같은 로컬 빌드가 안정적으로 동작하지 않음
- 따라서 실제 빌드 산출물(APK/AAB)은 GitHub Actions에서 생성하고, 아티팩트를 내려받아 테스트/배포에 사용

## 1) Bubblewrap 초기화
아래 명령으로 TWA 프로젝트를 생성한다.

```bash
NPM_CONFIG_CACHE=./.npm-cache npx @bubblewrap/cli init \
  --manifest "https://ott.preview.pe.kr/manifest.webmanifest" \
  --directory "apps/twa"
```

프롬프트 예시(중요 항목만):
- JDK 설치 질문: `No` (이미 JDK 17 사용 중이면)
- App name: `On the Timeline (OTT)`
- Short name: `OTT`
- Package name: `kr.pe.preview.ott`
- Host: `ott.preview.pe.kr`
- Start URL: `/`

## 2) APK 빌드(내부 테스트)
기본 경로: GitHub Actions에서 빌드

로컬 빌드(참고용, 현재 환경에서는 비권장):
```bash
cd apps/twa
./gradlew assembleDebug
```

결과 APK 경로:
- `apps/twa/app/build/outputs/apk/debug/app-debug.apk`

## 3) Asset Links 설정
TWA는 디지털 자산 링크 검증이 필요하다. 서명 키의 SHA-256 지문을 구한 후
`assetlinks.json`을 배포 도메인에 추가한다.

### SHA-256 지문 확인 (디버그 키 예시)
```bash
keytool -list -v \
  -keystore ~/.android/debug.keystore \
  -alias androiddebugkey \
  -storepass android \
  -keypass android
```

### assetlinks.json 템플릿
- 템플릿: `docs/assetlinks.template.json`
- 실제 배치 위치: `apps/web/public/.well-known/assetlinks.json`

## 4) 기기 설치 테스트
```bash
adb install -r apps/twa/app/build/outputs/apk/debug/app-debug.apk
```

## 참고
- 스토어 배포용은 AAB 빌드 필요 (`./gradlew bundleRelease`)
- 실서비스 배포 시에는 release keystore의 SHA-256으로 `assetlinks.json`을 갱신해야 함
- WSL ARM Linux 환경에서는 로컬 AAB 빌드도 동일한 호환 제약이 있으므로 CI 빌드를 권장

## CI (GitHub Actions) 빌드 준비
- Secrets: `TWA_KEYSTORE_BASE64`, `TWA_KEYSTORE_PASSWORD`, `TWA_KEY_ALIAS`, `TWA_KEY_PASSWORD`
- Base64 디코딩으로 `apps/twa/android.keystore` 생성 후 `apps/twa/keystore.properties` 작성
