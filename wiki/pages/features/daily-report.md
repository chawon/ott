# 데일리 리포트

> 매일 오전 9시 Telegram으로 Cloudflare·GA4·내부 분석·K8s 통합 현황 발송

## 관련 페이지
- [[analytics]]
- [[gitops]]

---

## 목표

ottline 운영 현황을 매일 한 곳에서 확인: Cloudflare(트래픽), GA4(사용자), 내부 admin analytics, K8s 인프라를 통합한 대시보드 제공 + 매일 KST 09:00 Telegram 자동 발송.

---

## 데이터 소스

| 소스 | 수집 데이터 | 방식 |
|---|---|---|
| Cloudflare | 요청수, 방문자, 대역폭, 위협 차단 | CF GraphQL Analytics API |
| GA4 | 세션, 활성 사용자, 페이지뷰, 신규 사용자 | GA4 Data API (서비스 계정) |
| 내부 analytics | DAU, 로그 생성, 신규 등록 | 기존 `AnalyticsService` 재사용 |
| Kubernetes | Pod 상태, 이미지 태그, CPU/Memory | K8s API (in-cluster) + Metrics Server |

---

## 백엔드 구현

**신규 서비스:**
- `CloudflareAnalyticsService` — CF GraphQL Zone Analytics
- `GoogleAnalyticsService` — GA4 Data API (`google-analytics-data` SDK)
- `KubernetesStatusService` — in-cluster K8s API (`kubernetes-client-java`)
- `DailyReportService` — 집계 + `@Scheduled("0 0 9 * * ?")` Telegram 발송

**API:**
- `GET /api/admin/report/daily` — 리포트 데이터 반환 (X-Admin-Token 인증)
- `POST /api/admin/report/daily/send` — 수동 Telegram 발송 트리거

**환경변수:**
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

---

## K8s RBAC

`deploy/oke/report-rbac.yaml`: ott-api ServiceAccount에 `pods`, `nodes`, `metrics.k8s.io` 읽기 권한 부여

---

## 프론트엔드

`apps/web/app/[locale]/admin/report/page.tsx`
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
• DAU: 89 | 로그 생성: 123
• 신규 등록: 5

☸️ 인프라 (K8s / ott ns)
• ott-web ✅ Running  [이미지 태그]
• ott-api ✅ Running  [이미지 태그]
```
