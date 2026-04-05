# 분석(Analytics)

> 플랫폼별(Web/PWA/TWA) 사용 지표 수집, 개인 리포트, 관리자 대시보드를 통합한 분석 시스템

## 관련 페이지
- [[daily-report]]
- [[pwa]]
- [[twa]]

---

## 목표

- Play Console 설치 지표와 별도로 서비스 사용 지표를 직접 집계
- 플랫폼별(Web, PWA, TWA) 사용성과 전환을 같은 기준으로 비교
- 출시 직후부터 재방문률(D1/D7/D30)과 핵심 전환(첫 기록 작성)을 추적

---

## 핵심 KPI

- 활성 사용자: DAU/WAU/MAU
- 재방문률: D1, D7, D30
- 전환율: 첫 방문→로그인, 로그인→첫 기록 작성
- 기능 사용률: 기록 작성률, 공유 기능 사용률

---

## 이벤트 스키마

| 이벤트 | 설명 |
|---|---|
| `app_open` | 앱 열기 |
| `login_success` | 기기 등록 성공 |
| `log_create` | 기록 생성 |
| `share_action` | 공유 기능 사용 |

**공통 필드:** `event_id`, `user_id`, `session_id`, `event_name`, `occurred_at`, `platform`, `client_version`, `properties`

`platform` 값: `web` | `pwa` | `twa`

---

## DB 스키마 (PostgreSQL)

```sql
create table analytics_events (
  event_id uuid primary key,
  user_id uuid null,
  session_id text not null,
  event_name text not null,
  platform text not null check (platform in ('web', 'pwa', 'twa')),
  client_version text null,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null
);
```

인덱스: `occurred_at`, `(event_name, occurred_at)`, `(user_id, occurred_at)`

---

## 라우트 구조

| 라우트 | 대상 |
|---|---|
| `/me/report` | 개인 리포트 (로컬 폴백 포함) |
| `/admin/analytics` | 관리자 전체 통계 대시보드 |

### 개인 리포트 (`/me/report`) 지표
- 총 기록 수, 이번 달 기록 수
- 완료율(DONE 비율), 평점/메모 입력률
- 선호 타입(movie/series/book), 선호 장소/함께한 방식
- 연속 기록일(streak)

**데이터 소스:** 서버 API(`/api/analytics/me/report`) 우선, 실패 시 IndexedDB 폴백

### 관리자 통계 (`/admin/analytics`)
- DAU/WAU/MAU, 퍼널, 플랫폼별 요약 카드
- 이벤트 종류별 집계, 일자별 집계, 최근 원시 이벤트 목록
- 마이그레이션 현황 섹션 (ott.preview.pe.kr → ottline.app 이전율)

---

## API 엔드포인트

| 엔드포인트 | 인증 | 설명 |
|---|---|---|
| `POST /api/analytics/events` | 없음 | 이벤트 수집 |
| `GET /api/analytics/me/report` | X-User-Id | 개인 리포트 |
| `GET /api/admin/analytics/overview?days=30` | X-Admin-Token | 관리자 개요 |
| `GET /api/admin/analytics/events` | X-Admin-Token | 원시 이벤트 목록 |
| `GET /api/admin/analytics/migration-status` | X-Admin-Token | 마이그레이션 현황 |

---

## 보안 모델

- 관리자 페이지는 `token` 기반 임시 방어 (MVP)
- 프로덕션 운영 단계에서는 세션 기반 권한 체계로 전환 필요
- 관리자 경로(`/admin`)는 `app_open` 이벤트 집계에서 제외

---

## 수집 구현 원칙

- 서버 수집 우선 (신뢰도·중복 방지·보안)
- 클라이언트는 이벤트 전송만 담당, 집계는 서버/DB
- `event_id` 중복 삽입 방지 (멱등)
- 민감 정보는 `properties`에 저장하지 않음
