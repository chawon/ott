# Browser Extension MVP

## 1. 목적
- PC 브라우저에서 OTT 작품 상세 페이지를 보고 있을 때 `On the Timeline` 기록 화면으로 빠르게 이어지게 한다.
- 자동 추적이나 자동 저장이 아니라, 사용자가 명시적으로 클릭해서 기록을 시작하는 보조 도구로 설계한다.
- 모바일의 `공유 -> 기록` 흐름을 데스크톱 브라우저까지 확장하는 역할로 본다.

## 2. 현재 구현 상태
1. 위치
   - `apps/browser-extension`
2. 구조
   - `manifest.json`
   - `content.js`
   - `popup.html`
   - `popup.css`
   - `popup.js`
   - `README.md`
3. 현재 동작
   - 지원 OTT 페이지에서 제목을 읽는다.
   - 확장 팝업에서 `On the Timeline에서 기록 시작` 버튼을 제공한다.
   - `https://ott.preview.pe.kr/ko`로 이동하면서 QuickLog 초기값을 query param으로 전달한다.
   - 웹앱 홈에서 `capture_title`, `capture_type`, `capture_platform`을 읽어 QuickLog 검색어와 플랫폼을 채운다.
4. 패키징
   - GitHub Actions `browser-extension-package.yml`에서 제출용 zip artifact 생성
   - 산출물 이름: `on-the-timeline-helper-<version>.zip`

## 2. 제품 원칙
1. 자동 저장 금지
   - 사용자가 콘텐츠를 보기만 해도 기록되면 안 된다.
2. 명시적 시작
   - 현재는 확장 버튼 클릭 시에만 동작한다.
3. 최소 권한
   - 모든 사이트를 광범위하게 읽지 않고, 필요한 사이트만 허용한다.
4. 본체 분리
   - 확장은 입력 보조 도구이고, 기록 저장과 관리의 중심은 웹앱/PWA다.

## 3. 추천 MVP 범위

### 기능
1. 현재 페이지가 지원 사이트의 작품 상세 페이지인지 감지
2. 제목/타입/원본 URL을 추출
3. 팝업에서 `On the Timeline에 기록하기` 진입 제공
4. 웹앱 기록 화면으로 초기값 전달
5. 사용자가 웹앱에서 최종 저장

### 비기능
1. 자동 시청 기록 수집 안 함
2. 백그라운드 추적 안 함
3. 계정/세션 탈취성 권한 사용 안 함

## 4. 사용 시나리오
1. 사용자가 PC에서 OTT 작품 상세 페이지를 연다.
2. 확장이 해당 페이지를 지원 대상으로 인식한다.
3. 툴바 버튼을 눌러 팝업을 열고 `On the Timeline에 기록하기`를 누른다.
4. `On the Timeline` 기록 화면이 열리며 제목/타입/원본 URL이 채워진다.
5. 사용자가 상태/메모를 입력하고 저장한다.

## 5. 기술 구조

### 확장
1. `content script`
   - 지원 사이트 DOM에서 제목/메타데이터 추출
2. `popup`
   - 현재 탭의 content script에 메시지를 보내 캡처 결과를 받음
   - 웹앱 URL 생성
3. `manifest.json`
   - 최소 권한만 선언

### 웹앱
1. 기록 진입 URL에서 초기값 수신
2. 예시 파라미터
   - `capture_title`
   - `capture_type`
   - `capture_platform`
   - `capture_source_url`
   - `capture_source_site`
3. QuickLog 화면에서 사용자가 최종 저장

## 6. 권한 원칙

### 추천 권한
- `activeTab`
- 필요한 도메인만 `host_permissions`

### 피해야 할 권한
- `<all_urls>`
- 불필요한 background 권한
- 다운로드/파일시스템/탭 전체 히스토리 접근

## 7. 지원 사이트 선정 기준
1. 작품 상세 URL 패턴이 명확할 것
2. 제목 추출 셀렉터가 비교적 안정적일 것
3. 사용 빈도가 높을 것
4. 법적/정책적 부담이 낮을 것

### 현재 지원 사이트
- Netflix
- Disney+
- TVING
- wavve
- Coupang Play
- WATCHA

메모:
- OTT 상세 페이지 URL 패턴과 `og:title` 기반 추출에 의존한다.
- 사이트 구조 변경 시 보정이 필요할 수 있다.

## 8. UX 방향
1. 툴바 버튼 클릭 시
   - 현재 페이지가 지원 대상이면 `기록으로 보내기`
   - 아니면 `지원되지 않는 페이지` 안내
2. 저장은 항상 웹앱에서
   - 확장 내부에서 기록을 직접 생성하지 않는다

## 9. 하지 않을 것
1. 사용자의 시청/열람 이력을 자동 수집
2. 브라우저 방문 이력 전체 추적
3. 사용자의 명시적 행동 없이 서버 전송
4. OTT 재생 상태를 상시 감시

## 10. 기대 효과
1. PC에서 기록 시작까지의 클릭 수 감소
2. 모바일 공유 기능과 데스크톱 경험 연결
3. Chrome Web Store 진출 시 명확한 제품 가치 확보

## 11. 다음 단계 제안
1. 실제 OTT 페이지에서 사이트별 캡처 정확도 검증
2. 필요 시 페이지 내 CTA 추가 여부 검토
3. locale/base URL 설정 페이지 추가 여부 검토
4. Chrome Web Store 진출 필요성은 MVP 검증 후 판단

## 12. 제출용 패키지 생성
1. GitHub Actions에서 `Package Browser Extension` 실행
2. 또는 `feat/browser-extension-mvp` / `main`에 관련 변경 push
3. Actions artifact에서 `on-the-timeline-helper-<version>.zip` 다운로드
4. Chrome Web Store 업로드 시 해당 zip 사용
