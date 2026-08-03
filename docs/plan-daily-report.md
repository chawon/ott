# Daily Operations Report

## Context
ottline 웹서비스 운영 현황을 매일 한 곳에서 확인하고 싶음.
현재 Cloudflare(트래픽), GA4(사용자), Clarity(UX), 내부 admin analytics, K8s 인프라를 각각 따로 확인해야 함.
목표: admin 페이지에서 통합 대시보드 제공 + 매일 오전 9시 Telegram 자동 발송.

**Clarity는 공개 API 없음 → 이번 범위에서 제외** (대시보드에 외부 링크만 추가)

---

## 구현 범위

### 데이터 소스
| 소스 | 데이터 | 방식 |
|------|--------|------|
| Cloudflare | 요청 수, 페이지뷰, 방문(`visits`, 고유 방문자 아님) | CF GraphQL Analytics API |
| GA4 | 세션, 활성 사용자, 페이지뷰, 신규 사용자 | GA4 Data API (서비스 계정) |
| 내부 analytics + DB | 실행 세션, 활성 클라이언트, 행동 사용자, 독립 행동 도달, 서버 반영 신규 로그 수 | `analytics_events` + `watch_logs.created_at` |
| Kubernetes | Pod 상태, Deployment 이미지, CPU/Memory (조회 시점 스냅샷) | K8s API (in-cluster config) + Metrics Server |

### 2026-08-03 Cloudflare KST 경계 보정

- 기존 `httpRequests1dGroups(filter: {date})`는 KST 날짜를 전달해도 UTC 날짜 버킷을 반환했다.
- HTTP 요청·페이지뷰는 `httpRequests1hGroups`, RUM 값은 `rumPageloadEventsAdaptiveGroups`를 사용한다.
- 두 데이터셋 모두 KST 전일 `[00:00, 다음 날 00:00)`을 UTC `datetime_geq`/`datetime_lt` 범위로 변환해 조회한다.
- GraphQL 변수로 zone, account, host와 시간 범위를 전달하고 반환 그룹이 여러 개면 모두 합산한다.
- PR `#87`, main SHA `12ed846350f9efed056d8c40b9ab5a10a381c0ca`, API production run `30786675495`로 배포했다. production `2026-08-02` 리포트는 직접 KST 범위 조회와 같은 `1105 requests / 248 pageViews / 8 visits`를 반환했고 수동 Telegram 발송도 확인했다.

### 2026-08-03 지표 의미와 조회 시점 정리

- Cloudflare RUM의 실제 필드명에 맞춰 API와 화면, Telegram에서 `visits`·`방문`으로 표시한다. 이 값은 고유 방문자 수로 해석하지 않는다.
- API 응답에는 순차 배포 호환을 위해 `visits`와 기존 `uniqueVisitors`를 같은 값으로 함께 반환한다. Web은 `visits`를 우선하고 구 API에서는 `uniqueVisitors`로 fallback한다.
- GA4 전일 수치는 조회 이후에도 보정될 수 있으므로 관리자 화면과 Telegram에 `잠정치`로 표시한다.
- Kubernetes 상태는 지속되는 실시간 값이 아니라 리포트 생성 시점의 스냅샷이다. 응답의 `generatedAt`과 함께 KST 조회 시각을 표시한다.
- iOS의 `installState=app_store_testflight`는 실제 설치 출처를 판별하지 않는 기존 호환 값이다. 관리자 화면은 App Store와 TestFlight 합계라고 추정하지 않고 `iOS 앱 (설치 출처 미구분)`으로 표시하며, 버전과 빌드 번호만 구분한다.
- PR `#88`, main SHA `5c70b2bab467d5b234dd3fc270e5d296f28d0e04`로 배포했다. PR API/Web CI run은 `30788544040`/`30788544046`, main API/Web CI run은 `30788661239`/`30788661226`, API/Web production run은 `30788807830`/`30788988123`, API/Web manifest commit은 `cfad3136c4e77585ff1245d0204a3040a2314666`/`e85b454b444042223ad767b4e26533dab910be07`이다.
- ArgoCD `ott-app`은 `Synced Healthy`, production `ott-api`/`ott-web` 이미지와 `APP_VERSION=5c70b2b`, Pod `1/1` ready·restart 0을 확인했다. 내부 리포트는 `generatedAt=2026-08-03T15:04:30+09:00`, `requests=1105`, `visits=8`, `uniqueVisitors=8`, `pageViews=248`, Cloudflare/GA4/Kubernetes `error=null`을 반환했다. production Web 이미지에서 새 관리자 문구를 확인했고, 새 형식 Telegram 테스트 발송은 `Daily report sent to Telegram` 로그로 확인했다. Web 배포의 production 버전 검증과 IndexNow도 성공했다.
- 이 배포는 API와 Web만 대상으로 했으며 iOS 네이티브 코드와 App Store 바이너리는 변경하지 않았다.

### 2026-04-15 집계 정의 조정
- 범위: 데일리 운영 리포트의 `앱 활동 (내부)` 섹션
- API/스키마 영향: 없음. 기존 `GET /internal/admin/report/daily` 응답 DTO에 내부 지표 필드만 확장
- 집계 정의:
  - `DAU`: 기존과 동일하게 `analytics_events.event_name = 'app_open'`의 고유 행위자 수
  - `제목 검색`: `analytics_events.event_name = 'title_search'`의 고유 행위자 수
  - `제목 선택`: `analytics_events.event_name = 'title_select'`의 고유 행위자 수
  - `기기 연결`: `analytics_events.event_name = 'login_success'`의 고유 행위자 수
  - `첫 기록`: `analytics_events.event_name = 'first_log_create'`의 고유 행위자 수
  - `기록 사용자`: `analytics_events.event_name = 'log_create'`의 고유 행위자 수
  - `신규 로그 수 (DB)`: `watch_logs.created_at`이 전일 KST 범위에 포함되는 row 수
  - 내부 지표는 관리자 analytics와 같은 관리자 UUID를 제외한다.
- 해석 원칙:
  - `제목 검색`과 `제목 선택`은 새 이벤트 배포 이후부터 의미 있게 쌓인다.
  - `기록 사용자`는 사용 행태 추적용 지표이며, 전송 실패나 오프라인 상황에 따라 실제 DB 반영 수와 다를 수 있다.
  - `신규 로그 수 (DB)`는 서버에 실제 반영된 신규 로그 수다.
  - sync로 늦게 올라온 오프라인 기록은 사용자가 어제 작성했더라도 서버 반영 시점 날짜로 잡힌다.

---

## 변경 파일 목록

### Backend (Spring Boot)

**신규 파일:**
- `apps/api/.../service/CloudflareAnalyticsService.java`
  - CF GraphQL API 호출 (Zone Analytics)
  - 반환: requests, visits, pageViews
- `apps/api/.../service/GoogleAnalyticsService.java`
  - GA4 Data API 호출 (`google-analytics-data` SDK)
  - 반환: sessions, activeUsers, screenPageViews, newUsers
- `apps/api/.../service/KubernetesStatusService.java`
  - in-cluster config으로 K8s API 호출 (`kubernetes-client-java`)
  - 반환: pod 상태 목록, deployment 이미지 태그, metrics-server에서 CPU/Memory
- `apps/api/.../service/DailyReportService.java`
  - 위 서비스 + `AnalyticsService` 결과 집계
  - `@Scheduled("0 0 9 * * ?")` - KST 09:00 자동 Telegram 발송
  - 기존 `TelegramNotifyService` 재사용 (or 동일 패턴으로 직접 호출)
- `apps/api/.../web/AdminDailyReportController.java`
  - `GET /internal/admin/report/daily` - 리포트 데이터 반환 (`X-Admin-Token` 인증)
  - `POST /internal/admin/report/daily/send` - 수동 Telegram 발송 트리거
- DTOs: `DailyReportDto`, `CloudflareStatsDto`, `Ga4StatsDto`, `K8sStatusDto`

**수정 파일:**
- `apps/api/build.gradle` (또는 `pom.xml`) - 의존성 추가
  - `com.google.analytics:google-analytics-data`
  - `io.kubernetes:client-java`
- `apps/api/src/main/resources/application.yaml` - 설정 추가
  ```yaml
  cloudflare:
    api-token: ${CF_API_TOKEN:}
    zone-id: ${CF_ZONE_ID:}
  google-analytics:
    property-id: ${GA4_PROPERTY_ID:}
    credentials-json: ${GA4_CREDENTIALS_JSON:}  # base64 서비스 계정 JSON
  report:
    schedule: "0 0 0 * * ?"  # UTC 00:00 = KST 09:00
  ```

### K8s

**신규 파일:**
- `deploy/oke/report-rbac.yaml`
  - ott-api ServiceAccount에 pods, nodes, metrics.k8s.io 읽기 권한 부여
- `deploy/oke/external-secret.yaml`
  - OCI Vault + ESO(External Secrets Operator) 연동
  - SecretStore: InstancePrincipal 인증 (auth 블록 생략)
  - ExternalSecret: OCI Vault 시크릿 → K8s Secret `ott-api-secrets` 생성

**수정 파일:**
- `deploy/oke/external-secret.yaml` - ESO ExternalSecret에 키 추가
  - `CF_API_TOKEN`, `CF_ZONE_ID`, `CF_ACCOUNT_TAG`
  - `GA4_PROPERTY_ID`, `GA4_CREDENTIALS_JSON`
  - `ADMIN_ANALYTICS_TOKEN`, `TMDB_ACCESS_TOKEN`
  - `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
  - 비밀이 아닌 값(`TELEGRAM_NOTIFY_ENABLED`, `TELEGRAM_SERVICE_NAME`, `CF_REQUEST_HOST`)은 api-deployment.yaml에 직접 env로 관리

### Frontend (Next.js)

**신규 파일:**
- `apps/web/app/admin/report/page.tsx`
  - 서버에서만 `X-Admin-Token`을 붙여 내부 API를 호출
  - 4개 섹션: Cloudflare / GA4 / 내부 지표 / K8s

---

## Telegram 메시지 포맷

```
📊 ottline 데일리 리포트 (MM/DD)

🌐 트래픽 (Cloudflare)
• 요청: 12,345 | 방문: 1,234 | 페이지뷰: 2,345

📈 사용자 (GA4 · 잠정치)
• 세션: 890 | 활성: 678
• 페이지뷰: 2,345 | 신규: 234
• 전일 값은 조회 시점 기준 잠정치이며 이후 보정될 수 있어요.

🎯 앱 활동 (내부)
• 실행 세션: 89 | 활성 클라이언트: 72
• 행동 사용자: 34 | 원본 실행 이벤트: 103
• 검색 사용자: 21 | 제목 선택 사용자: 18
• 기기 연결 사용자: 5 | 첫 기록 사용자: 3 | 기록 사용자: 8
• 신규 로그 수(DB): 123

☸️ 인프라 (K8s · 09:00 KST 현재)
• ott-web ✅ Running  [이미지 태그]
• ott-api ✅ Running  [이미지 태그]
• CPU: web 12% / api 8%
• Mem: web 180MB / api 320MB
```

---

## 재사용할 기존 코드
- `AnalyticsService.adminOverview()` - 내부 DAU/로그 지표 재사용
- Telegram 발송 패턴: `notify.telegram.*` 설정 + RestTemplate 직접 호출 방식 참조
- 인증: `admin.analytics.token` 검증 방식 동일하게 적용

---

## 구현 순서
1. Backend: CF/GA/K8s 서비스 + DailyReportController
2. K8s RBAC + Secret 업데이트
3. Frontend: /admin/report 페이지
4. 스케줄러 + Telegram 발송 연결

---

## 검증
1. production Pod 내부에서 `X-Admin-Token`을 사용해 `GET /internal/admin/report/daily` 응답 확인
2. production Pod 내부에서 `POST /internal/admin/report/daily/send`를 호출해 Telegram 수신 확인
3. `/admin/report?token=xxx` 페이지 렌더링 확인
4. 스케줄러 로그 (KST 09:00 자동 발송)
5. K8s RBAC 권한 오류 없이 Pod 목록 조회 확인
6. 같은 사용자가 하루에 로그를 여러 건 생성해도 `로그 생성 사용자`는 1명으로 유지되는지 확인
7. `watch_logs.created_at` 기준 전일 생성 row 수가 `신규 로그 수(DB)`에 반영되는지 확인
8. 오프라인 후 다음날 sync된 로그가 `신규 로그 수(DB)`에는 sync 시점 날짜로 잡히는지 점검
