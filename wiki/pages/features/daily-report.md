# 데일리 리포트

> 매일 오전 9시 Telegram으로 Cloudflare·GA4·자체 분석·Kubernetes 현황을 발송하고, 같은 데이터를 top-level 관리자 화면에서 확인한다.

## 관련 페이지
- [[analytics]]
- [[gitops]]

---

## 목적과 화면

`/admin/report`는 Cloudflare 요청·방문자·page view, GA4 session·활성/신규 사용자, 자체 제품 활동과 production pod 상태를 한 화면에 보여준다. 관리자 화면은 locale segment를 사용하지 않고 한국어로 고정한다.

`DailyReportService`는 KST 기준 전일 범위를 집계하고 기본 schedule인 UTC 00:00(KST 09:00)에 Telegram 메시지를 보낸다.

---

## 데이터 소스

| 소스 | 수집 데이터 | 방식 |
|---|---|---|
| Cloudflare | 요청 수, 방문자, page view | Cloudflare GraphQL Analytics API |
| GA4 | session, 활성 사용자, page view, 신규 사용자 | GA4 Data API 서비스 계정 |
| 자체 analytics | 실행 session, 활성 client, 행동 사용자, 독립 행동 도달 | `analytics_events` |
| 서비스 DB | 서버에 반영된 신규 기록 수 | `watch_logs.created_at` |
| Kubernetes | pod 상태, image tag, CPU/memory | in-cluster API + Metrics Server |

---

## 자체 지표 정의

데일리 리포트와 관리자 analytics overview는 같은 `AnalyticsMetricsQuery`를 사용한다.

- `rawAppOpenEvents`: 전일 원본 `app_open` 이벤트 수
- `appOpenSessions`: 전일 distinct 실행 session 수
- `activeClients`: 전일 `app_open`을 보낸 distinct client 수
- `qualifiedActors`: 검색·선택·연결·첫 기록·기록 생성 중 하나를 수행한 resolved actor 수
- `titleSearchActors`, `titleSelectActors`, `loginActors`, `firstLogCreateActors`, `logCreateActors`: 각 행동의 독립 도달
- `dbLogCreateCount`: `watch_logs.created_at`이 전일 KST 범위에 포함된 row 수

resolved actor는 계정 → 한 계정에만 연결된 client → client → session 순으로 결정하며 관리자 UUID는 제외한다. 행동 지표는 순차 funnel이 아니므로 검색 없이 제목을 선택한 session도 제목 선택 도달에 포함된다.

이벤트 지표는 전송 성공 여부의 영향을 받고, `dbLogCreateCount`는 서버에 실제 반영된 수다. offline 기록이 다음날 sync되면 작성 시점이 아니라 서버 반영일에 집계된다.

---

## API와 보안 경계

- `GET /internal/admin/report/daily`: 현재 전일 리포트 반환
- `POST /internal/admin/report/daily/send`: 현재 리포트를 Telegram으로 수동 발송
- 두 endpoint 모두 web 서버가 server-to-server `X-Admin-Token`을 붙여 호출한다.
- 브라우저는 backend `/internal/admin/**`를 직접 호출하거나 관리자 token을 전달받지 않는다.

`/admin/report`는 Cloudflare Access의 `Account Member` 정책을 통과해야 한다. origin의 Next.js `proxy`도 `Cf-Access-Jwt-Assertion`의 서명, issuer, audience, `exp`, `nbf`, `type=app`을 검증한다. 관리자 root layout에는 GA4, Clarity, PWA/service worker와 일반 사용자 sync runtime을 로드하지 않는다.

---

## 설정

~~~yaml
cloudflare:
  api-token: ${CF_API_TOKEN:}
  zone-id: ${CF_ZONE_ID:}
google-analytics:
  property-id: ${GA4_PROPERTY_ID:}
  credentials-json: ${GA4_CREDENTIALS_JSON:}
report:
  schedule: "0 0 0 * * *"
~~~

`deploy/oke/report-rbac.yaml`은 API service account에 필요한 pod·node·metrics read 권한만 부여한다.

---

## Telegram 메시지

~~~text
📊 ottline 데일리 리포트 (YYYY-MM-DD)

🌐 트래픽 (Cloudflare)
• 요청 / 방문자 / 페이지뷰

📈 사용자 (GA4)
• 세션 / 활성 사용자 / 페이지뷰 / 신규 사용자

🎯 앱 활동 (내부)
• 실행 세션 / 활성 클라이언트
• 행동 사용자 / 원본 실행 이벤트
• 검색 / 제목 선택 / 기기 연결 / 첫 기록 / 기록 사용자
• 신규 로그 수(DB)

☸️ 인프라 (K8s / ott)
• pod 상태 / image tag / CPU / memory
~~~

---

## 보존

자체 `analytics_events`는 `created_at` 기준 180일 후 매일 자동 파기한다. 데일리 리포트는 전일 데이터만 사용하므로 이 보존 정책의 영향을 받지 않는다. GA4와 Microsoft Clarity로 전송된 데이터의 보존은 각 제공자의 설정과 정책을 따르며, Clarity는 데일리 리포트의 데이터 소스가 아니다.
