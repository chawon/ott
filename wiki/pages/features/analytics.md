# 분석(Analytics)

> Web/PWA/TWA/iOS 사용 지표, 개인 리포트, 관리자 운영 지표와 검색 유입 이후 행동을 함께 보는 분석 시스템

## 관련 페이지
- [[daily-report]]
- [[pwa]]
- [[twa]]

---

## 집계 원칙

- `app_open` 원본 이벤트, 실행 session, 활성 client, resolved actor를 구분한다.
- resolved actor는 계정 → 한 계정에만 연결된 client → client → session 순서로 결정한다. 공유 client와 관리자 계정은 안전하게 분리한다.
- 검색·제목 선택·기기 연결·첫 기록·기록 생성은 순차 funnel이 아니라 각각의 독립 행동 도달로 본다.
- 검색 노출·click·CTR·position은 Google Search Console, landing 이후 행동은 자체 analytics를 기준으로 삼는다. 두 데이터를 개인 단위로 결합하지 않는다.

---

## 이벤트와 공통 context

주요 이벤트:

| 이벤트 | 설명 |
|---|---|
| `app_open` | 브라우저 tab session 또는 native 앱 실행 |
| `title_search` | 제목 검색 |
| `title_select` | 제목 선택 |
| `login_success` | 기기 연결 성공 |
| `first_log_create` | 해당 사용자의 첫 기록 생성 |
| `log_create` | 기록 생성 |
| `guide_cta_click` | 검색 가이드에서 QuickLog로 이동 |

공통 필드는 `event_id`, `user_id`, `client_id`, `session_id`, `event_name`, `occurred_at`, `platform`, `client_version`, `properties`다. `platform`은 `web`, `pwa`, `twa`, `ios_native` 중 하나다.

웹 context에는 `hostname`, `landingPath`, referrer origin, locale, device/browser/OS, 설치 상태와 UTM을 넣는다. URL의 `source` 값은 `android-watch-reminder`, `android-revisit-reminder`만 `entrySource`로 저장하며 임의 값과 전체 referrer query는 저장하지 않는다.

수집 API는 광고 차단기의 일반 analytics 경로 차단을 줄이기 위해 `POST /api/nalytic/events`를 사용한다. `event_id`는 멱등 key다.

---

## 핵심 지표

### 제품 활동

- `rawAppOpenEvents`: 원본 `app_open` 수
- `appOpenSessions`: distinct 실행 session 수
- `activeClients`: `app_open`을 보낸 distinct client 수
- `qualifiedActors`: 검색·선택·연결·첫 기록·기록 생성 중 하나를 수행한 resolved actor 수
- `reach`: `titleSearchActors`, `titleSelectActors`, `loginActors`, `firstLogCreateActors`, `logCreateActors`

### 유입 session

유입 지표는 요청 기간 안에 web/PWA/TWA `app_open`이 있는 distinct session만 분모로 삼고 `ios_native`는 제외한다.

- `sessions`: 유입 session
- `engagedSessions`: 같은 session에 검색·선택·연결·첫 기록·기록 생성 중 하나가 있는 수
- `firstLogSessions`: 같은 session에 `first_log_create`가 있는 수
- `logCreateSessions`: 같은 session에 `log_create`가 있는 수
- `orphanConversionSessions`: 행동 이벤트는 있지만 해당 기간에 `app_open`이 없는 session

attribution 우선순위는 유효한 UTM → 허용된 `entrySource` → 외부 referrer → direct/unknown이다. channel은 `organic_search`, `paid_search`, `ai_referral`, `social`, `store_referral`, `referral`, `owned_reengagement`, `direct`, `unknown`으로 정규화한다.

---

## 화면과 API

| 화면/endpoint | 역할 |
|---|---|
| `/me/report` | 개인 리포트. 서버 실패 시 IndexedDB fallback |
| `/admin/analytics` | Cloudflare Access로 보호되는 한국어 관리자 대시보드 |
| `GET /api/nalytic/me/report` | `X-User-Id` 기반 개인 리포트 |
| `GET /internal/admin/analytics/overview?days=` | 제품 활동·도달·platform/device segment |
| `GET /internal/admin/analytics/acquisition?days=7\|30\|90\|180` | 유입 summary와 channel/source/landing/locale/campaign/daily 집계 |
| `GET /internal/admin/analytics/events` | 최근 원시 이벤트 |
| `GET /internal/admin/analytics/migration-status` | 과거 domain migration 상태 확인용 계약 |

유입 응답의 `summary`와 각 dimension row는 `sessions`, `engagedSessions`, `firstLogSessions`, `logCreateSessions`를 사용한다. 응답에는 `byChannel`, `bySource`, `byLandingPath`, `byLocale`, `byCampaign`, `daily`, `orphanConversionSessions`가 포함된다.

---

## 관리자 보안 경계

- 관리자 UI는 locale 밖 top-level `/admin/**`만 사용한다.
- Cloudflare Access self-hosted application의 기준 path는 `/admin`이며 bare path와 하위 경로 모두 Cloudflare 계정 `Account Member`만 허용한다.
- origin의 Next.js `proxy`는 `Cf-Access-Jwt-Assertion`의 RS256 서명, issuer, audience, 만료/활성 시간과 `type=app`을 team JWKS로 다시 검증한다.
- 관리자 layout에는 GA4, Clarity, PWA/service worker와 일반 사용자 sync runtime을 로드하지 않는다.
- 관리자 server page와 same-origin BFF만 backend `/internal/admin/**`에 `X-Admin-Token`을 전달한다. token은 URL·HTML·브라우저 요청에 노출하지 않는다.

---

## 보존과 삭제

- 자체 `analytics_events`는 `created_at` 기준 180일 후 매일 자동 파기한다.
- 계정 전체 삭제 시 해당 계정에 연결된 analytics event는 즉시 삭제한다.
- 계정과 연결되지 않아 특정 이용자를 식별할 수 없는 이벤트는 선별 삭제할 수 없고 180일 보존 정책으로 파기한다.
- GA4와 Microsoft Clarity로 전송된 데이터의 보존은 각 제공자의 설정과 정책을 따른다.
- `properties`에는 메모·검색 query·전체 referrer URL 같은 민감하거나 불필요한 값을 넣지 않는다.
