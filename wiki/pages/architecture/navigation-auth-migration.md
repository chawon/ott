# 도메인 마이그레이션 (ott.preview.pe.kr → ottline.app)

> Redirect Flow 기반 사용자 인증 정보 이식 구현

## 관련 페이지
- [[ottline-branding]]
- [[gitops]]
- [[analytics]]

---

## 개요

Storage Partitioning 등 브라우저 보안 정책으로 인해 단순 도메인 이전 시 기존 인증 정보(`localStorage`)가 새 도메인으로 자동 이식되지 않는다. 이를 해결하기 위해 네비게이션 기반 Redirect Flow를 구현했다. 이 플로우는 `2026-04-18` Cloudflare 301 전환과 함께 운영 종료되었고, 현재는 이전 이력 문서로 유지한다.

---

## 구현 상세

### MigrationBanner.tsx (운영 종료)
- **구 도메인 전용:** `ott.preview.pe.kr`에서만 노출
- **데이터 추출:** `localStorage`의 `userId`, `deviceId`, `pairingCode` 읽기
- **리다이렉트:**
  - 일반 웹: `window.location.href`로 신규 도메인 이동
  - PWA: `window.open`으로 외부 브라우저에서 신규 도메인 열기 (PWA Scope 제한 해결)

### migration-helper/page.tsx (운영 종료)
- URL 파라미터 `u`, `d`, `p`로 데이터 수신
- `localStore`에 저장 후 `watchlog.migration-success` 플래그 설정
- 저장 완료 후 홈(`/`)으로 자동 이동

### 성공 안내 (MigrationBanner.tsx 보강, 운영 종료)
- `migration-success` 플래그 감지 시 초록 배너로 완료 안내
- PWA 사용자에게 새 도메인 앱 설치 권장 및 기존 앱 삭제 가이드 제공

---

## 기술적 해결 사항

- **CORS:** 백엔드(`WebConfig.java`)에서 `ottline.app` 도메인 명시적 허용
- **컷오버:** 최종 전환은 Cloudflare `301`로 처리해 `ott.preview.pe.kr/*`를 `https://ottline.app/*`로 바로 연결

---

## 이전율 추적

`migration_complete` 이벤트를 analytics_events에 적재해 이전율을 관리자 대시보드에서 확인 가능하다.

```sql
-- 활성 사용자 (기록 2개 이상)
SELECT COUNT(*) FROM (
  SELECT user_id FROM watch_logs
  WHERE user_id IS NOT NULL
  GROUP BY user_id HAVING COUNT(*) >= 2
) t;

-- 이전 완료 사용자
SELECT COUNT(DISTINCT user_id) FROM analytics_events
WHERE event_name = 'migration_complete';
```

## 현재 운영 상태

- `2026-04-18`부터 `ott.preview.pe.kr/*`는 Cloudflare에서 `https://ottline.app/*`로 301 리다이렉트된다.
- 웹앱의 MigrationBanner와 클라이언트 기반 자동 이사 UI는 운영 종료했고, canonical 진입점은 `ottline.app` 단일 도메인이다.
- admin analytics의 `migration_complete`와 `oldDomainUsage`는 과거 이전 이력 및 301 전환 후 잔존 유입 관측용으로 유지한다.
