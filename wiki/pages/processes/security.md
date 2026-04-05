# 보안 (Security)

> 코드 리뷰에서 발견된 보안 이슈 및 사고 대응 체크리스트

## 관련 페이지
- [[gitops]]
- [[staging]]

---

## 코드 리뷰 발견 이슈 (2026-02-06)

### Critical: 저장소에 운영 비밀정보 평문 커밋
- `deploy/oke/api-secret.yaml` — DB 계정, TMDB 토큰, NAVER 키
- `deploy/oke/registry-secret.yaml` — `.dockerconfigjson` base64
- `apps/api/src/main/resources/application-local.yaml` — TMDB 토큰
- `docs/GitOps_Guide.md` — ArgoCD 계정/비밀번호

**영향:** 계정 탈취, 인프라 악용, 과금/데이터 유출

### Critical: 인증 없는 사용자 데이터 조회 가능
- `LogController.java` — `X-User-Id` optional → 헤더 없이도 타 사용자 로그 조회 가능
- `SyncService.java` — `userId == null`이면 전체 로그 pull

**해결책:** `X-User-Id`, `X-Device-Id` 필수화 + 서버 측 디바이스 소유 검증. `userId == null` 경로에서 401/403 반환.

### High: Sync Push에서 요청 본문 `userId` 신뢰
- `SyncService.java` — `req.userId()`를 신뢰해 타 계정 데이터 변경 가능

**해결책:** `userId`는 헤더/세션 기반으로 서버가 확정, body 값 무시

### High: 로그 수정(PATCH)에서 null clear 미반영
- 웹은 null 전송하나 서버는 null이면 무시 → 평점/메모/플랫폼 지워도 서버 유지
- sync update도 동일 문제

**해결책:** PATCH 계약 재정의 — `{"note": null}`은 실제 `setNote(null)` 처리

### Medium: CSV Formula Injection 방어 없음
- `apps/web/lib/export.ts` — `=`, `+`, `-`, `@`로 시작하는 셀 값이 엑셀에서 수식 실행 가능

**해결책:** 해당 패턴 시작 시 `'` prefix 적용

---

## 시크릿 관리 현황 (2026-03-29 완료)

**OCI Vault + External Secrets Operator(ESO) v2.2.0으로 완전 전환 완료.**

- 모든 시크릿(`TMDB_ACCESS_TOKEN`, `NAVER_CLIENT_ID/SECRET`, DB 계정, OCIR Auth Token 등) OCI Vault로 이관
- `deploy/oke/api-secret.yaml` 평문 제거 → `deploy/oke/external-secret.yaml` 로 대체
- ESO Oracle provider — `auth` 블록 생략 시 InstancePrincipal 자동 인증
- 비밀이 아닌 값(`TELEGRAM_NOTIFY_ENABLED` 등)은 `api-deployment.yaml`에 직접 env로 관리
- 시크릿 즉시 반영: `kubectl annotate externalsecret ott-api-secrets -n ott force-sync=$(date +%s) --overwrite`

> 아래 체크리스트는 사고 발생 시 참고용 (현재 미해결 항목 없음)

---

## 원칙

> Public 저장소에 노출된 시크릿은 외부 수집(크롤링/봇 스캔) 가능성이 높으므로, 노출 시점부터 유출로 간주하고 회전하는 것을 기본 원칙으로 한다.
