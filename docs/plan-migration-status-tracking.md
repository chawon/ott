# 개발 계획: 마이그레이션 현황 추적

> **브랜치**: `feat/migration-status-tracking`
> **기준일**: 2026-03-16
> **영향 범위**: 프론트(migration-helper, admin/analytics) + 백엔드(AnalyticsService, AdminAnalyticsController)

---

## 목표

- `migration_complete` 이벤트를 서버에 기록해 마이그레이션 완료 여부를 추적
- 관리자 analytics 페이지에 마이그레이션 현황 섹션 추가
- 이를 기반으로 301 리다이렉트 전환 시점을 데이터로 판단

---

## 한계 및 전제

- 이 작업 배포 **이전**에 이전한 사용자는 집계 불가 → "배포 시점부터" 카운트
- "기록 2개 이상" 기준은 `watch_logs` 테이블 서버 데이터 기준
- 잠수 유저(기록은 있지만 앱 미접속)는 분모에 포함되나 이전 불가능 유저로 간주

---

## 작업 항목

### Task 1. 프론트 — migration-helper 이벤트 추적

**파일**: `apps/web/app/[locale]/migration-helper/page.tsx`

마이그레이션 성공 시 `trackEvent("migration_complete")` 호출 추가.
`userId`는 이미 URL 파라미터로 존재하므로 properties에 포함.

```ts
// migration 성공 직후
await trackEvent("migration_complete", { from_domain: "ott.preview.pe.kr" });
```

---

### Task 2. 백엔드 — migration-status API 추가

**새 엔드포인트**: `GET /api/admin/analytics/migration-status`
- 헤더: `X-Admin-Token` 필요

**응답 DTO** (`AdminMigrationStatusDto`):
```json
{
  "totalActiveUsers": 120,
  "migratedUsers": 87,
  "notMigratedUsers": 33,
  "migrationRate": 72.5,
  "recentMigrations": [
    { "date": "2026-03-16", "count": 5 },
    { "date": "2026-03-15", "count": 3 },
    ...
  ]
}
```

**쿼리 설계**:

```sql
-- totalActiveUsers: 서버에 기록 2개 이상인 사용자
SELECT COUNT(*) FROM (
  SELECT user_id FROM watch_logs
  WHERE user_id IS NOT NULL
  GROUP BY user_id HAVING COUNT(*) >= 2
) t;

-- migratedUsers: migration_complete 이벤트 발생 고유 사용자
SELECT COUNT(DISTINCT user_id) FROM analytics_events
WHERE event_name = 'migration_complete'
  AND user_id IS NOT NULL;

-- recentMigrations: 최근 14일 일별 카운트
SELECT DATE(occurred_at) as date, COUNT(*) as count
FROM analytics_events
WHERE event_name = 'migration_complete'
GROUP BY DATE(occurred_at)
ORDER BY date DESC
LIMIT 14;
```

**수정 파일**:
- `AdminMigrationStatusDto.java` (신규)
- `AnalyticsService.java` — `adminMigrationStatus()` 메서드 추가
- `AdminAnalyticsController.java` — `/migration-status` 엔드포인트 추가

---

### Task 3. 프론트 — admin analytics 페이지에 섹션 추가

**파일**: `apps/web/app/[locale]/admin/analytics/page.tsx`

기존 overview 섹션 아래에 "마이그레이션 현황" 섹션 추가:

```
┌─────────────────────────────────────────┐
│ 마이그레이션 현황                         │
├──────────┬──────────┬──────────┬────────┤
│ 활성유저  │ 이전완료  │ 미이전   │ 이전율  │
│  120명   │  87명    │  33명   │ 72.5%  │
├──────────┴──────────┴──────────┴────────┤
│ 최근 14일 일별 이전 수 (bar 또는 텍스트)  │
│ 2026-03-16: 5건                         │
│ 2026-03-15: 3건                         │
│ ...                                     │
│                                         │
│ ℹ 신규 이전이 3일 이상 0건이면            │
│   301 리다이렉트 전환을 검토하세요.        │
└─────────────────────────────────────────┘
```

---

## 검증 시나리오

1. migration-helper에서 u/d/p 파라미터로 접근 시 `migration_complete` 이벤트 analytics_events에 저장 확인
2. `/api/admin/analytics/migration-status` 응답 정상 반환 확인
3. admin analytics 페이지에 마이그레이션 현황 섹션 렌더링 확인
4. 이전율 계산 정확성 확인 (migratedUsers / totalActiveUsers)
5. recentMigrations 일별 데이터 정상 출력 확인

---

## 완료 기준

- [ ] migration_complete 이벤트 서버 적재 확인
- [ ] `/api/admin/analytics/migration-status` 응답 정상
- [ ] admin 페이지 마이그레이션 현황 섹션 표시
- [ ] `npm run lint` + `npm run test` 통과
