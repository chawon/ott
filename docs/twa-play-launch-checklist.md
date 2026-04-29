# TWA Google Play 출시 체크리스트

## 목적
- `app.ottline` TWA를 Google Play에 안정적으로 배포
- 내부 테스트에서 프로덕션 출시까지 단계적으로 검증

## 기준 정보 (출시 전 고정)
- 패키지명: `app.ottline`
- 도메인: `https://ottline.app`
- 앱명: `ottline`
- 등록 문구/브랜딩 기준: `docs/twa-play-store-listing-ko.md`

## 1) 서명/보안 준비
- [ ] release keystore 최종 확정 (분실 방지 백업 포함)
- [ ] GitHub Secrets 최신화
  - `TWA_KEYSTORE_BASE64`
  - `TWA_KEYSTORE_PASSWORD`
  - `TWA_KEY_ALIAS`
  - `TWA_KEY_PASSWORD`
- [ ] release keystore SHA-256 fingerprint 확인
- [ ] `apps/web/public/.well-known/assetlinks.json`에 release fingerprint 반영
- [ ] 배포된 도메인에서 `/.well-known/assetlinks.json` 접근 확인

### 진행 업데이트 (2026-02-14)
- [x] `apps/web/public/.well-known/assetlinks.json` 갱신
  - `relation`:
    - `delegate_permission/common.handle_all_urls`
    - `delegate_permission/common.get_login_creds`
  - fingerprint:
    - `FF:83:9F:7B:63:74:47:2D:D4:EF:5F:B4:4A:0E:6A:54:4F:5D:A9:A6:79:C5:FA:05:C0:6F:63:B8:E3:07:A3:36`
    - `0E:25:31:CD:8B:18:6B:F3:5D:7C:10:13:7B:AC:FA:D0:97:42:52:A5:13:0E:43:E6:3C:5F:4B:04:88:66:56:66`
    - `5A:B6:69:AB:DA:C1:22:68:06:F3:9B:EE:C2:45:F3:88:43:2A:53:9D:B2:15:44:D7:82:90:68:20:7D:F3:59:70`

## 2) 빌드/아티팩트 준비
- [x] GitHub Actions `Build TWA Release AAB` 실행
- [ ] 결과물 `app-release.aab` 다운로드
- [ ] AAB 파일명에 버전 식별 정보 추가 보관 (예: 날짜/릴리즈 태그)

### 진행 업데이트 (2026-02-18)
- [x] GitHub Actions에 Google Play 배포 자동화 반영 (`gplay release`)
  - 워크플로우: `.github/workflows/twa-release.yml`
  - 신규 입력값: `track`, `release_status`, `rollout`
  - 신규 시크릿: `GPLAY_SERVICE_ACCOUNT_JSON` (서비스 계정 JSON 본문)
  - 처리 단계: AAB 빌드 → gplay 설치 → 인증 → Play 트랙 배포
- [x] 배포 자동화 워크플로우 실행 성공
  - Run: `22127449914` (workflow_dispatch, main)
  - 입력값: `version_code=4`, `version_name=1.0.0`, `track=internal`
  - 결과: `Deploy to Google Play` 단계 포함 전체 성공

### 진행 업데이트 (2026-04-17)
- [x] GitHub Actions 수동 AAB 빌드 성공
  - Run: `24555921495` (`Build TWA Release AAB (Manual Upload)`)
  - 입력값: `version_code=5`, `version_name=1.0.1`
  - Artifact: `ottline-release-aab-1.0.1`
  - 비고: 로컬 WSL 빌드는 `aapt2` 호환 문제로 계속 비권장

## 3) Play Console 앱 생성 / 기본 설정
- [x] Play Console 앱 생성 (패키지명 `app.ottline`)
- [ ] 기본 언어 `ko-KR` 확인
- [ ] 앱 유형 `App` / 과금 `Free` 확인
- [ ] 카테고리 `Lifestyle` 입력
- [ ] 연락처 이메일 `contact@ottline.app` 입력
- [x] 개인정보처리방침 URL 입력
  - `https://ottline.app/privacy`
- [ ] 필요 시 Website 입력 (`https://ottline.app/faq` 또는 `https://ottline.app`)

## 4) App content / 정책 선언
- [ ] Ads: `No` 확인
- [ ] App access: 기본 기록 기능은 로그인 없이 리뷰 가능하다고 명시
- [ ] Target audience and content 작성
- [ ] Data safety 설문 작성
- [ ] 콘텐츠 등급 설문 완료
- [ ] 앱 설명/개인정보처리방침/실제 동작이 서로 모순되지 않는지 확인

## 5) 스토어 등록정보 준비
- [ ] 앱 이름/짧은 설명/상세 설명을 `docs/twa-play-store-listing-ko.md` 기준으로 입력
- [ ] 앱 아이콘 업로드 (`512x512`, PNG)
- [ ] 피처 그래픽 업로드 (`1024x500`, JPG 또는 24-bit PNG)
- [ ] 휴대폰 스크린샷 최소 2장 업로드
- [ ] 한국어 기본 메타데이터 검토 (필요 시 다국어 추가)
- [ ] 구 도메인 `ott.preview.pe.kr` 또는 예전 브랜드가 에셋에 남아 있지 않은지 확인

### 진행 업데이트 (2026-02-14, Step 5 시작)
- [x] 스토어 문구 초안 문서 작성: `docs/twa-play-store-listing-ko.md`
- [x] 업로드용 에셋 체크리스트/규격 정리
- [ ] Play Console에 초안 반영
- [ ] 스크린샷 최종본 반영 (휴대폰 2종 이상)
- [ ] 최종 카피 리뷰 후 게시용 확정

## 6) 테스트 트랙 배포 (권장 순서)
- [x] 내부 테스트 트랙에 AAB 업로드
- [ ] 테스터 설치 확인 (Play를 통한 설치)
- [ ] 핵심 시나리오 점검
  - [ ] 앱 실행/스플래시/스탠드얼론 동작
  - [ ] 로그인/로그아웃
  - [ ] 기록 생성/수정/타임라인 반영
  - [ ] 공유 기능 (TWA 공유 인텐트 → 작품 검색 프리필)
  - [ ] 딥링크 진입
- [ ] 이슈 수정 후 내부 테스트 재배포
- [x] 클로즈드 테스트(`alpha`) 시작

### 진행 업데이트 (2026-02-18, 내부 테스트 배포)
- [x] 내부 테스트 트랙 릴리즈 반영 확인
  - 트랙: `internal`
  - 상태: `completed`
  - 버전: `1.0.0` (`versionCode=4`)
- [x] Play Console에서 비공개 출시 적용 완료

### 진행 업데이트 (2026-04-18, 비공개 테스트 시작)
- [x] 클로즈드 테스트 트랙 릴리즈 반영 확인
  - 트랙: `alpha`
  - 상태: `completed`
  - 버전: `1.0.2` (`versionCode=6`)
- [x] 비공개 테스트 테스터 그룹 연결 확인
  - 그룹: `ottline-beta-testers@googlegroups.com`

### 진행 업데이트 (2026-04-21, 위젯 디자인 리프레시 재배포)
- [x] 클로즈드 테스트 트랙 재배포 반영 확인
  - 브랜치: `feat/twa-widget-design`
  - GitHub Actions Run: `24705603466`
  - 트랙: `alpha`
  - 상태: `completed`
  - 버전: `1.0.3` (`versionCode=7`)
- [ ] Play 설치본에서 홈 화면 위젯 디자인 리프레시 실기기 확인
  - [ ] 2x2 위젯 레이아웃 정상 표시
  - [ ] `기록하기` / `타임라인` 액션 진입 확인

### 진행 업데이트 (2026-04-29, Android 진입면 보강 후보)
- [x] 런처 롱프레스 shortcuts 구현
  - [x] `기록하기` → `/?quick=1&quick_focus=1`
  - [x] `영상 기록` → `/?quick=1&quick_type=video&quick_focus=1`
  - [x] `책 기록` → `/?quick=1&quick_type=book&quick_focus=1`
  - [x] `타임라인` → `/timeline`
- [x] PWA/TWA Web Share Target 계약 명시
  - [x] PWA manifest `share_target` 추가
  - [x] TWA `METADATA_SHARE_TARGET` 추가
  - [x] 홈에서 `shared_url`도 공유 입력으로 처리
- [x] 홈 화면 위젯 액션 분리
  - [x] `영상`
  - [x] `책`
  - [x] `타임라인`
- [ ] 다음 alpha 재배포 시 실기기 확인
  - [ ] 앱 롱프레스 shortcut 4종 표시 및 진입
  - [ ] 외부 앱 URL/text 공유 → QuickLog 검색 프리필
  - [ ] 위젯 `영상` / `책` / `타임라인` 진입

### 진행 업데이트 (2026-02-15)
- [x] TWA 공유 인텐트 MVP 구현 완료 (`feat/twa-share-intent-mvp` → `main` 머지)
  - Android: `ACTION_SEND`, `ACTION_SEND_MULTIPLE` 수신
  - Web: `shared_text`, `shared_subject` 기반 작품 검색 프리필
  - 파서 보강: 넷플릭스/디즈니+/프라임/애플TV/티빙 URL 케이스 대응
  - 오탐 방지: 쿠팡플레이 홍보문구 + 단축 URL(app.link) 저신뢰 입력 제외
- [ ] GitHub Actions 산출물로 실기기 공유 시나리오 QA
  - [ ] Netflix 공유
  - [ ] Disney+ 공유
  - [ ] Prime Video 공유
  - [ ] Apple TV 공유
  - [ ] TVING URL 공유

### 진행 업데이트 (2026-02-16)
- [x] 실기기 공유 QA 진행
  - [x] Netflix: 제목 파싱/검색 성공
  - [x] Disney+: 제목 파싱/검색 성공
  - [x] Apple TV: 제목 파싱/검색 성공
  - [x] Prime Video: 시즌 정보 제거 후 제목만 검색하도록 보정
  - [x] 플랫폼 자동 매핑: 넷플릭스/디즈니플러스/애플티비/프라임비디오/티빙/쿠팡플레이/왓챠
- [x] URL 전용 공유 고도화
  - [x] `share-resolve` 라우트 추가 (`/share-resolve`)
  - [x] 티빙 제목 후처리 (`1화 | TVING` 꼬리 제거)
  - [x] 쿠팡플레이 app.link 웹 폴백(`$web_only=true`) 재시도
- [x] 메뉴 전환 UX 안정화
  - [x] 다크/라이트 초기 페인트 플래시 완화
  - [x] 홈 → 타임라인/함께 이동 시 좌우 흔들림 완화

### 진행 업데이트 (2026-02-17)
- [x] 모바일 스와이프 메뉴 이동 테스트 기능 반영
  - [x] 좌/우 스와이프로 메인 탭 이동 (`/`, `/timeline`, `/public`, `/account`)
  - [x] 시스템 백 제스처/입력 터치 충돌 방지 가드 적용
- [x] 함께 기록 시즌 메타 보정
  - [x] 시즌 포스터 사용 시 시즌 연도도 함께 노출되도록 API 보완

## 7) 프로덕션 출시
- [ ] 프로덕션 트랙에 릴리즈 생성
- [ ] 변경사항(Release notes) 작성
- [ ] 점진 배포(예: 10% -> 50% -> 100%) 전략 적용
- [ ] 롤백 기준/담당자 사전 합의

## 8) 출시 후 모니터링
- [ ] Crash/ANR 모니터링 (출시 직후 24~72시간 집중)
- [ ] 로그인/기록 저장 성공률 점검
- [ ] 사용자 피드백/리뷰 모니터링
- [ ] 긴급 패치 여부 판단

## 운영 메모
- WSL(ARM Linux) 환경 호환 제약으로 로컬 Android 빌드는 비권장
- APK/AAB는 GitHub Actions를 기준으로 생성/배포
- 키 유출이 의심되면 즉시 키 교체 및 CI 시크릿 전면 갱신
- 현재 저장소 기준 Android 배포 경로는 `apps/twa`, Expo 앱(`apps/native`)은 별도 후보 구현

## Step 5 실행 순서 (권장)
1. `docs/twa-play-store-listing-ko.md` 기준으로 앱 이름/설명/연락처/정책 URL 입력
2. 아이콘/피처 그래픽/스크린샷을 규격에 맞춰 업로드
3. App content에서 Ads/App access/Data safety/Content rating를 현재 서비스 기준으로 입력
4. 스토어 미리보기에서 줄바꿈/문구 잘림과 구 브랜드 잔존 여부 확인
5. 내부 테스트 트랙 사용자 3명 이상에게 스토어 페이지 가독성 리뷰 요청
6. 피드백 반영 후 Step 6(테스트 트랙 배포)로 이동
