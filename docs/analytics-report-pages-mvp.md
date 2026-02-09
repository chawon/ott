# 분석 리포트 페이지 MVP (Web/PWA/TWA 공통)

## 목표
- 사용자에게 개인 이용 리포트 페이지 제공
- 운영자에게 서비스 전체 통계 페이지 제공
- 동일 이벤트 스키마를 기반으로 플랫폼별 지표 비교 가능하게 구성

## 라우트
- 사용자: `/me/report`
- 관리자: `/admin/analytics` (관리자 전용 접근 제어 필수)

## 1차 MVP 범위
### 사용자 리포트 (`/me/report`)
- 내 총 기록 수
- 이번 달 기록 수
- 완료율(DONE 비율)
- 평점 입력률
- 메모 입력률
- 선호 타입(movie/series/book)
- 선호 장소/함께한 방식(place/occasion)
- 연속 기록일(streak)

데이터 소스:
- 서버 리포트 API(`/api/analytics/me/report`) 우선 사용
- API 실패 시 `IndexedDB(localStore)` 집계로 폴백

### 관리자 통계 (`/admin/analytics`)
- `token` 기반 접근 제어 + 서버 집계 API 연동 완료
- DAU/WAU/MAU, 퍼널, 플랫폼별 요약 카드 노출
- 추후 연결 지표:
  - DAU/WAU/MAU
  - D1/D7/D30
  - 방문 -> 로그인 -> 첫 기록 퍼널
  - 플랫폼별(web/pwa/twa) 비교

## 보안 모델
- 관리자 페이지는 "전용 URL"만으로 보호하지 않는다.
- 최소 요구:
  - 서버 측 검증 가능한 관리자 토큰 또는 세션/RBAC
  - 로그 기록(누가 언제 접속했는지)
- 권장:
  - 사내 SSO 또는 OAuth 기반 관리자 인증
  - 관리자 API와 일반 사용자 API 분리

## 구현 단계
1. 프론트 라우트 생성
- [x] `/me/report` 서버 우선 리포트 + 로컬 폴백
- [x] `/admin/analytics` API 연동 대시보드

2. 데이터 계층
- [x] 개인 리포트 로컬 집계 유틸
- [x] 이벤트 수집 테이블/엔드포인트
- [x] 관리자용 기본 집계 API
- [x] 프론트 이벤트 트래킹 (`app_open`, `login_success`, `log_create`, `share_action`)

3. 운영 적용
- [ ] 관리자 인증 고도화(RBAC/SSO)
- [ ] 대시보드 알림/주간 리포트

## 환경 변수 제안
- `ADMIN_ANALYTICS_TOKEN`: 관리자 페이지 임시 접근 토큰

주의:
- 토큰 기반 접근은 MVP 단계의 임시 방안이다.
- 프로덕션 운영 단계에서는 세션 기반 권한 체계로 전환 필요.

## 백엔드 API (MVP)
- `POST /api/analytics/events`
  - 헤더: `X-User-Id` (선택)
  - 요청 본문:
    - `eventId`(선택, uuid)
    - `eventName`(필수, `^[a-z0-9_]{2,64}$`)
    - `platform`(필수, `web|pwa|twa`)
    - `sessionId`(선택)
    - `clientVersion`(선택)
    - `occurredAt`(선택, ISO)
    - `properties`(선택, json)
- `GET /api/analytics/me/report`
  - 헤더: `X-User-Id` (필수)
  - 응답: 개인 리포트 요약 지표
- `GET /api/admin/analytics/overview?days=30`
  - 헤더: `X-Admin-Token` (필수)
  - 환경 변수 `ADMIN_ANALYTICS_TOKEN`과 일치해야 접근 가능
