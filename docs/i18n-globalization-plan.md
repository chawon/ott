# 다국어(i18n) 및 글로벌 서비스화(Globalization) 계획 (완료)

## 1. 개요 및 목적
현재 PWA 및 TWA 기반으로 제공 중인 서비스를 Microsoft Store 등 글로벌 스토어에 배포하기 위해, 다국어(i18n) 지원 체계를 구축한다. 한국어(ko)와 영어(en)를 지원하며, 향후 확장 가능한 구조를 마련한다. (2026-03-06 완료)

## 2. 범위 (Scope) - 완료
1. **프론트엔드 (`apps/web` - Next.js App Router)**
   - `next-intl` 기반 다국어 라우팅 및 텍스트 번역 적용 완료
   - 미들웨어를 통한 사용자 언어 감지 및 설정 완료
2. **백엔드 (`apps/api` - Spring Boot)**
   - `Accept-Language` 헤더 수신 및 처리 완료
   - TMDB 외부 API 호출 시 언어 정보 전달 (`language` 파라미터) 완료
3. **스토어 배포 자산**
   - 다국어 PWA Manifest 및 SEO 메타데이터 대응 완료

---

## 3. 프론트엔드 (Next.js) 다국어 구현 결과

### 3.1 라이브러리 및 라우팅
- **`next-intl`** 적용.
- URL 기반 언어 구분 (`/ko/...`, `/en/...`).
- **Middleware**: 브라우저 언어 감지 및 리다이렉트 처리.
- **사전(Dictionaries)**: `messages/en.json`, `messages/ko.json` 관리.

### 3.2 주요 변경 사항
- `app/` 하위 모든 라우트를 `app/[locale]/`로 이동.
- 공통 컴포넌트(Header, Footer, Navigation) 및 핵심 도메인 화면(Home, Timeline, Detail, QuickLog) 번역 완료.
- `lib/utils.ts` 내 라벨 생성 로직(Status, Place, Occasion, Rating) 다국어 지원 및 기본값 영문 변경.

---

## 4. 백엔드 (Spring Boot) 다국어 대응 결과

### 4.1 API 헤더 처리
- 모든 핵심 Controller(`Title`, `Log`, `Tmdb`, `Sync`, `Comment`)에서 `Accept-Language` 헤더를 수신하도록 수정.
- 프론트엔드 `lib/api.ts`에서 전역적으로 현재 locale을 헤더에 포함하여 전송.

### 4.2 외부 데이터 연동
- TMDB API 호출 시 클라이언트 locale을 전달하여 검색 결과 및 상세 정보가 해당 언어로 반환되도록 처리.
- `SyncService`를 통해 데이터 동기화 시에도 타이틀 정보를 해당 언어로 풍부화(hydration)하도록 개선.

---

## 5. 실행 결과 요약

### Phase 1: 기반 설정 (완료)
- `next-intl` 설치 및 미들웨어 설정.
- 라우팅 구조 마이그레이션 및 기본 사전 구축.

### Phase 2: UI 번역 (완료)
- 전체 UI 텍스트 추출 및 번역 적용 (100% 완료).
- 공유 카드(OG) 샘플 데이터 및 워터마크 로컬라이징 완료.

### Phase 3: 백엔드 데이터 연동 (완료)
- TMDB 다국어 파라미터 적용 및 컨트롤러 헤더 수신 처리.
- 동기화 로직 내 다국어 데이터 처리 보강.

### Phase 4: SEO 및 기타 (완료)
- 동적 Metadata(SEO) 및 PWA Manifest 언어 대응 완료.
- 구글 서치 인증 파일(`google2e68e76488843a73.html`) 추가.

---

## 6. 특이사항 및 향후 관리
- **날짜 포맷**: 언어 설정에 따라 `ko-KR` 또는 `en-US` 형식을 동적으로 적용한다.
- **UUID Fallback**: `crypto.randomUUID` 미지원 환경(HTTP 등)을 위해 `Math.random` 기반 폴백 로직을 `lib/utils.ts`에 추가하였다.
- **향후 언어 추가**: `messages/` 폴더에 새 JSON 파일을 추가하고 `i18n/routing.ts`의 `locales` 배열에 추가하는 것으로 손쉽게 확장 가능하다.
