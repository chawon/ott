# 다국어(i18n) 및 글로벌 서비스화(Globalization) 계획

## 1. 개요 및 목적
현재 PWA 및 TWA 기반으로 제공 중인 서비스를 Microsoft Store 등 글로벌 스토어에 배포하기 위해, 다국어(i18n) 지원 체계를 구축한다. 우선적으로 한국어(ko)와 영어(en)를 지원하며, 향후 일본어 등 기타 언어로 손쉽게 확장할 수 있는 구조를 마련한다.

## 2. 범위 (Scope)
1. **프론트엔드 (`apps/web` - Next.js App Router)**
   - 다국어 라우팅 및 텍스트 번역 적용
   - 사용자 언어 감지 및 설정
2. **백엔드 (`apps/api` - Spring Boot)**
   - 다국어 에러 메시지 지원
   - TMDB 외부 API 호출 시 언어 정보 전달 (`language` 파라미터)
3. **스토어 배포 자산**
   - Microsoft Store 및 Google Play Store 다국어 스크린샷, 설명문 준비 (별도 작업)

---

## 3. 프론트엔드 (Next.js) 다국어 구현 방안

### 3.1 라이브러리 선정
Next.js App Router 환경에서 Server/Client Component를 모두 지원하며 보일러플레이트가 적은 **`next-intl`** 라이브러리를 사용한다.

### 3.2 아키텍처 및 라우팅
- URL 기반 언어 구분 방식 채택 (`/ko/...`, `/en/...`). SEO 최적화 및 사용자에게 명시적인 언어 제공.
- **Middleware**: 접속 시 사용자의 브라우저 언어(`Accept-Language`)를 감지하여 적절한 언어 경로로 리다이렉트한다.
- **사전(Dictionaries)**: 언어별 JSON 파일 유지 (`messages/en.json`, `messages/ko.json`).

### 3.3 핵심 변경 대상 파일
- `next.config.ts`: `next-intl` 플러그인 설정 추가.
- `middleware.ts`: 언어 감지 및 라우팅 로직 추가.
- `app/[locale]/layout.tsx`: 기존 Root Layout을 다국어 지원 구조로 마이그레이션.
- 컴포넌트 내 하드코딩된 한국어 문자열 ➜ `useTranslations()` 훅 또는 서버 컴포넌트 번역 함수로 교체.

---

## 4. 백엔드 (Spring Boot) 다국어 대응 방안

### 4.1 클라이언트 언어 정보 수신
- 프론트엔드 프록시 또는 직접 호출 시 `Accept-Language` 헤더를 통해 사용자의 선호 언어 전달받음.

### 4.2 TMDB API 연동
- 타이틀 검색(`GET /api/titles/search`) 및 시즌/에피소드 조회(`GET /api/tmdb/...`) 시, 클라이언트에서 전달받은 언어 코드를 TMDB API의 `language` 파라미터로 치환하여 호출한다.
  - 예: `Accept-Language: ko-KR` ➜ TMDB API `language=ko-KR`

### 4.3 에러 응답
- 필요한 경우 `MessageSource`를 활용해 커스텀 비즈니스 예외 메시지를 언어별로 반환한다. (현재는 HTTP 상태 코드 및 간단한 메시지로 충분할 수 있음)

---

## 5. 단계별 실행 계획 (Action Plan)

### Phase 1: 기반 설정 및 프론트엔드 보일러플레이트 (P0)
1. `apps/web`에 `next-intl` 설치 및 기본 설정(Config, Middleware).
2. `app` 디렉토리 하위의 기존 페이지들을 `app/[locale]` 하위로 이동.
3. 기본 사전(`ko.json`, `en.json`) 뼈대 파일 생성.

### Phase 2: 핵심 컴포넌트 텍스트 추출 및 번역 (P1)
1. 공통 UI 컴포넌트 (Header, Footer, Navigation) 내 텍스트 치환.
2. 주요 도메인 화면 (Home, Timeline, Title Detail, QuickLogCard 등) 내 하드코딩 텍스트 추출.
3. 메타데이터(SEO), PWA Manifest(이름 등) 다국어 처리.

### Phase 3: 백엔드 및 외부 데이터 다국어 연동 (P1)
1. 백엔드 `TmdbController` 및 Service가 `Accept-Language`를 처리하여 TMDB 호출 시 언어를 동적으로 반영하도록 수정.
2. 프론트엔드 API 호출 유틸리티(`lib/api.ts`)에서 전역적으로 헤더에 사용자의 현재 `locale`을 포함하도록 수정.

### Phase 4: QA 및 스토어 준비 (P2)
1. 언어 전환 테스트 및 언어 누락분 검수.
2. Microsoft Store용 영문/국문 스크린샷 및 소개 문구 작성.

---

## 6. 기타 고려사항
- **Local DB (Dexie) 데이터 마이그레이션 방안**: 로그 데이터 자체는 사용자가 입력한 데이터이므로 번역의 대상이 아니다. 하지만 타임라인 내에 시스템이 생성하는 자동 메시지(예: "~을 보았습니다")가 있다면 이를 어떻게 표기할지 결정 필요. (가능하면 데이터에는 행동 타입만 저장하고, 화면에서 번역하여 렌더링하는 것을 권장)
- **날짜 포맷**: 언어에 따라 날짜 표시 형식(Date formatting)을 다르게 적용한다. (예: `ko`는 `YYYY년 M월 D일`, `en`은 `MMM D, YYYY`)