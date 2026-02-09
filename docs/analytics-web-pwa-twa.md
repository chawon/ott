# 웹/PWA/TWA 공통 분석 지표 설계안

## 목표
- Play Console 설치 지표와 별도로 서비스 사용 지표를 직접 집계한다.
- 플랫폼별(Web, PWA, TWA) 사용성과 전환을 같은 기준으로 비교한다.
- 출시 직후부터 재방문률(D1/D7/D30)과 핵심 전환(첫 기록 작성)을 추적한다.

## 범위
- 포함: Web, PWA, TWA(Android)
- 제외: 스토어 노출/전환(Play Console 전용 지표)

## 핵심 KPI
- 활성 사용자: DAU/WAU/MAU
- 재방문률: D1, D7, D30
- 전환율:
  - 첫 방문 -> 로그인
  - 로그인 -> 첫 기록 작성
- 기능 사용률:
  - 기록 작성률
  - 공유 기능 사용률

## 이벤트 설계 (최소 버전)
- `app_open`
- `login_success`
- `log_create`
- `share_action`

각 이벤트 공통 필드:
- `event_id` (uuid)
- `user_id` (익명 상태는 null 가능)
- `session_id`
- `event_name`
- `occurred_at` (UTC)
- `platform` (`web` | `pwa` | `twa`)
- `client_version` (웹 배포 버전 또는 앱 버전명)
- `properties` (jsonb, 옵션)

## 테이블 예시 (PostgreSQL)
```sql
create table if not exists analytics_events (
  event_id uuid primary key,
  user_id uuid null,
  session_id text not null,
  event_name text not null,
  platform text not null check (platform in ('web', 'pwa', 'twa')),
  client_version text null,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null
);

create index if not exists idx_analytics_events_occurred_at
  on analytics_events (occurred_at);

create index if not exists idx_analytics_events_name_time
  on analytics_events (event_name, occurred_at);

create index if not exists idx_analytics_events_user_time
  on analytics_events (user_id, occurred_at);
```

## 초기 지표 SQL
### 1) DAU (최근 30일)
```sql
select
  date_trunc('day', occurred_at)::date as day,
  count(distinct user_id) filter (where user_id is not null) as dau
from analytics_events
where occurred_at >= now() - interval '30 days'
  and event_name = 'app_open'
group by 1
order by 1;
```

### 2) D1 리텐션 (가입일 코호트 기준)
```sql
with signup as (
  select user_id, min(occurred_at)::date as signup_day
  from analytics_events
  where event_name = 'login_success'
    and user_id is not null
  group by user_id
),
revisit as (
  select
    s.signup_day,
    s.user_id,
    exists (
      select 1
      from analytics_events e
      where e.user_id = s.user_id
        and e.event_name = 'app_open'
        and e.occurred_at::date = s.signup_day + 1
    ) as retained_d1
  from signup s
)
select
  signup_day,
  count(*) as cohort_size,
  round(100.0 * avg(case when retained_d1 then 1 else 0 end), 1) as d1_retention_pct
from revisit
group by signup_day
order by signup_day desc;
```

### 3) 로그인 -> 첫 기록 작성 전환율
```sql
with first_login as (
  select user_id, min(occurred_at) as first_login_at
  from analytics_events
  where event_name = 'login_success'
    and user_id is not null
  group by user_id
),
first_log as (
  select user_id, min(occurred_at) as first_log_at
  from analytics_events
  where event_name = 'log_create'
    and user_id is not null
  group by user_id
)
select
  count(*) as logged_in_users,
  count(*) filter (where flg.first_log_at is not null) as users_with_log,
  round(
    100.0 * count(*) filter (where flg.first_log_at is not null) / nullif(count(*), 0),
    1
  ) as login_to_first_log_pct
from first_login fl
left join first_log flg on flg.user_id = fl.user_id;
```

## 수집 구현 원칙
- 서버 수집 우선: 신뢰도/중복 방지/보안 측면에서 유리
- 클라이언트는 이벤트 전송만 담당하고, 집계는 서버/DB에서 수행
- 멱등 처리: `event_id` 중복 삽입 방지
- 개인정보 최소화: 민감 정보는 `properties`에 저장하지 않음

## 운영 체크리스트
- [ ] 이벤트 스키마 확정 및 공통 SDK/유틸 구현
- [ ] `app_open`, `login_success`, `log_create`, `share_action` 우선 적용
- [ ] 배치 또는 뷰로 DAU/D1 대시보드 구성
- [ ] 플랫폼(`web`/`pwa`/`twa`)별 비교 리포트 주간 리뷰
- [ ] 이벤트 누락/지연 모니터링 알림 구성

## Play Console과의 역할 분담
- Play Console:
  - 설치/활성 설치/스토어 전환/크래시-ANR
- 내부 분석:
  - 재방문(D1/D7/D30), 전환, 기능 사용률, 사용자 행동 흐름
