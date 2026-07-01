# 웹/PWA/TWA/iOS Native 공통 분석 지표 설계안

## 목표
- Play Console 설치 지표와 별도로 서비스 사용 지표를 직접 집계한다.
- 플랫폼별(Web, PWA, TWA, iOS Native) 사용성과 전환을 같은 기준으로 비교한다.
- 출시 직후부터 재방문률(D1/D7/D30)과 핵심 전환(첫 기록 작성)을 추적한다.

## 범위
- 포함: Web, PWA, TWA(Android), iOS Native
- 제외: 스토어 노출/전환(Play Console/App Store Connect 전용 지표)

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
- `platform` (`web` | `pwa` | `twa` | `ios_native`)
- `client_version` (웹 배포 버전 또는 앱 버전명)
- `properties` (jsonb, 옵션)

현재 수집 API의 실제 공개 경로는 `/api/nalytic/events`다. 브라우저/확장 프로그램이 일반적인 analytics 수집 API로 인식해 차단하는 것을 줄이기 위해 `analytics` 대신 `nalytic` 이름을 사용한다.

Android TWA 앱은 Bubblewrap launch URL의 `android_app_version`, `android_app_version_code` 파라미터와 TWA referrer/standalone 세션 신호를 조합해 `platform=twa`로 분류한다. `properties`에는 Android 앱 통계용으로 아래 값을 추가한다.

- `androidAppVersion`
- `androidAppVersionCode`
- `androidTwaSignal` (`android_referrer` | `versioned_launch_url` | `android_webview` | `android_standalone_context` | `session`)

`2026-06-06` 기준 PR `#49`로 관리자 analytics Android 앱 세그먼트까지 production 반영 완료. 배포 SHA는 `fa528c2f82a4ded2c02fac97919155add2a61f5f`, staging run은 web `27063419471` / API `27063419474`, production run은 web `27063488252` / API `27063487861`이다.

### iOS Native 출시 후 분석 도구 메모 (2026-07-01)

iOS Native는 WebView/PWA/TWA 래퍼가 아니므로 웹에 삽입한 GA4 `gtag.js`, Microsoft Clarity script, Cloudflare Web Analytics snippet을 그대로 공유하지 않는다. 제품 퍼널의 source of truth는 기존 서버 수집 경로 `/api/nalytic/events`이며, iOS 앱은 `platform=ios_native`, `appVersion`, `buildNumber`, `installId`, `sessionId`, `locale`, `theme`, `route`를 포함해 전송한다.

도구별 역할은 아래처럼 분리한다.

- 내부 admin analytics: iOS 앱 내 행동, 첫 기록 전환, 제목 검색/선택, 버전/build 세그먼트 확인. 현재 우선 기준.
- GA4: 필요 시 Firebase Analytics 또는 React Native Firebase 같은 native SDK로 별도 app stream을 붙인다. 웹 `G-...` gtag snippet 재사용 대상이 아니다.
- Microsoft Clarity: 필요 시 React Native/iOS SDK로 붙인다. 화면 녹화/터치 분석을 쓰기 전 기록, 프로필, 문의, 복구 코드 화면의 마스킹 정책을 먼저 정한다.
- Cloudflare: `https://ottline.app` API 호출과 edge 트래픽은 볼 수 있지만, native 화면 전환/버튼 퍼널을 직접 수집하는 도구로 보지 않는다.
- App Store Connect Analytics: 설치, 제품 페이지, 다운로드, 리텐션 같은 스토어 관점 지표를 확인한다. 앱 내부 행동 퍼널과는 별도다.

후속 정리 후보: App Store 공개 이후 `installState=app_store_testflight` 고정값은 `app_store`로 바꾸거나 `distributionChannel=app_store|testflight`처럼 분리한다.

## 테이블 예시 (PostgreSQL)
```sql
create table if not exists analytics_events (
  event_id uuid primary key,
  user_id uuid null,
  session_id text not null,
  event_name text not null,
  platform text not null check (platform in ('web', 'pwa', 'twa', 'ios_native')),
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
- [ ] 플랫폼(`web`/`pwa`/`twa`/`ios_native`)별 비교 리포트 주간 리뷰
- [ ] 이벤트 누락/지연 모니터링 알림 구성

## Play Console과의 역할 분담
- Play Console:
  - 설치/활성 설치/스토어 전환/크래시-ANR
- App Store Connect:
  - 설치/제품 페이지/다운로드/리텐션
- 내부 분석:
  - 재방문(D1/D7/D30), 전환, 기능 사용률, 사용자 행동 흐름
