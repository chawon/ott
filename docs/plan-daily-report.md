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
| Cloudflare | 요청수, 방문자, 대역폭, 위협 차단 | CF GraphQL Analytics API |
| GA4 | 세션, 활성 사용자, 페이지뷰, 신규 사용자 | GA4 Data API (서비스 계정) |
| 내부 analytics + DB | DAU, 로그 생성 사용자, 서버 반영 신규 로그 수, 신규 등록 | `analytics_events` + `watch_logs.created_at` |
| Kubernetes | Pod 상태, Deployment 이미지, CPU/Memory (실시간) | K8s API (in-cluster config) + Metrics Server |

### 2026-04-15 집계 정의 조정
- 범위: 데일리 운영 리포트의 `앱 활동 (내부)` 섹션
- API/스키마 영향: 없음. 기존 `GET /api/admin/report/daily` 응답 DTO에 내부 지표 필드만 확장
- 집계 정의:
  - `DAU`: 기존과 동일하게 `analytics_events.event_name = 'app_open'`의 고유 행위자 수
  - `로그 생성 사용자`: `analytics_events.event_name = 'log_create'`의 고유 행위자 수
  - `신규 로그 수 (DB)`: `watch_logs.created_at`이 전일 KST 범위에 포함되는 row 수
  - `신규 기기`: 기존과 동일하게 `analytics_events.event_name = 'login_success'`의 고유 행위자 수
- 해석 원칙:
  - `로그 생성 사용자`는 사용 행태 추적용 지표이며, 전송 실패나 오프라인 상황에 따라 실제 DB 반영 수와 다를 수 있다.
  - `신규 로그 수 (DB)`는 서버에 실제 반영된 신규 로그 수다.
  - sync로 늦게 올라온 오프라인 기록은 사용자가 어제 작성했더라도 서버 반영 시점 날짜로 잡힌다.

---

## 변경 파일 목록

### Backend (Spring Boot)

**신규 파일:**
- `apps/api/.../service/CloudflareAnalyticsService.java`
  - CF GraphQL API 호출 (Zone Analytics)
  - 반환: requests, uniq visitors, bandwidth, threats
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
  - `GET /api/admin/report/daily` - 리포트 데이터 반환 (X-Admin-Token 인증)
  - `POST /api/admin/report/daily/send` - 수동 Telegram 발송 트리거
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
- `apps/web/app/[locale]/admin/report/page.tsx`
  - 기존 analytics 페이지와 동일한 토큰 인증 방식
  - 4개 섹션: Cloudflare / GA4 / 내부 지표 / K8s
  - "Telegram 지금 발송" 버튼

---

## Telegram 메시지 포맷

```
📊 ottline 데일리 리포트 (MM/DD)

🌐 트래픽 (Cloudflare)
• 요청: 12,345 | 방문자: 1,234
• 대역폭: 45.2 MB | 위협 차단: 12

📈 사용자 (GA4)
• 세션: 890 | 활성: 678
• 페이지뷰: 2,345 | 신규: 234

🎯 앱 활동 (내부)
• DAU: 89 | 로그 생성 사용자: 63
• 신규 로그 수(DB): 123 | 신규 등록: 5

☸️ 인프라 (K8s / ott ns)
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
1. `GET /api/admin/report/daily?token=xxx` 응답 확인
2. `POST /api/admin/report/daily/send` → Telegram 수신 확인
3. `/admin/report?token=xxx` 페이지 렌더링 확인
4. 스케줄러 로그 (KST 09:00 자동 발송)
5. K8s RBAC 권한 오류 없이 Pod 목록 조회 확인
6. 같은 사용자가 하루에 로그를 여러 건 생성해도 `로그 생성 사용자`는 1명으로 유지되는지 확인
7. `watch_logs.created_at` 기준 전일 생성 row 수가 `신규 로그 수(DB)`에 반영되는지 확인
8. 오프라인 후 다음날 sync된 로그가 `신규 로그 수(DB)`에는 sync 시점 날짜로 잡히는지 점검
