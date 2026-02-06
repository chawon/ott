# 코드 리뷰 보고서 (2026-02-06)

## 검토 범위
- `apps/web`, `apps/api`, `deploy/oke`, `docs` 전반
- 최근 기능: 책 기록(NAVER), 공유 카드, PWA/TWA, 타임라인 CSV, 로컬 동기화

## 실행 검증 결과
- `npm run build --workspace ott`: 성공
- `npm run lint --workspace ott`: 실패 (Biome 진단 다수)
- `apps/api` `GRADLE_USER_HOME=.gradle ./gradlew test`: 성공 (실제 테스트는 `contextLoads` 1건만 존재)

## 주요 이슈 (심각도 순)

### 1) Critical: 저장소에 운영 비밀정보가 평문/복호화 가능한 형태로 커밋됨
- 근거:
  - `deploy/oke/api-secret.yaml:7` (DB 계정, TMDB 토큰, NAVER 키)
  - `deploy/oke/registry-secret.yaml:7` (`.dockerconfigjson` base64)
  - `apps/api/src/main/resources/application-local.yaml:22` (TMDB 토큰)
  - `docs/GitOps_Guide.md:111` (ArgoCD 계정/비밀번호)
- 영향:
  - 계정 탈취, 인프라 악용, 과금/데이터 유출 위험이 즉시 존재
- 권장 조치:
  - 즉시 키/비밀번호 전면 회전
  - Git 기록에서 비밀 제거(BFG/git filter-repo)
  - `Secret` 매니페스트는 템플릿만 남기고 실제 값은 CI Secret/Vault로 주입

### 2) Critical: 인증 없는 사용자 데이터 조회 가능 (로그 전체 노출 가능)
- 근거:
  - `apps/api/src/main/java/com/watchlog/api/web/LogController.java:38` (`X-User-Id` optional)
  - `apps/api/src/main/java/com/watchlog/api/repo/WatchLogRepository.java:22` (`userId is null or ...`)
  - `apps/api/src/main/java/com/watchlog/api/web/SyncController.java:29` (`X-User-Id` optional)
  - `apps/api/src/main/java/com/watchlog/api/service/SyncService.java:70` (`userId == null`이면 전체 로그 pull)
- 영향:
  - 헤더 없이 호출해도 타 사용자 로그를 조회할 수 있음
- 권장 조치:
  - `X-User-Id`, `X-Device-Id` 필수화 + 서버 측 디바이스 소유 검증
  - `userId == null` 경로에서 전체 데이터 반환 금지 (401/403)

### 3) High: Sync Push가 요청 본문의 `userId`를 신뢰해 쓰기 권한 위조 가능
- 근거:
  - `apps/api/src/main/java/com/watchlog/api/service/SyncService.java:45` (`req.userId()` 사용)
  - `apps/api/src/main/java/com/watchlog/api/service/SyncService.java:302` 이후 (`reqUserId`로 로그 소유자 처리)
- 영향:
  - 클라이언트가 임의 `userId`를 넣어 타 계정 데이터 변경 시도 가능
- 권장 조치:
  - `userId`는 헤더/세션 기반으로 서버가 확정하고 body 값은 무시
  - `deviceId`-`userId` 매핑 검증 실패 시 즉시 거부

### 4) High: 로그 수정(PATCH)에서 `null` 클리어가 서버에 반영되지 않음
- 근거:
  - 웹은 null 전송: `apps/web/app/title/[id]/page.tsx:457`, `apps/web/app/title/[id]/page.tsx:458`, `apps/web/app/title/[id]/page.tsx:459`
  - 서버는 null이면 무시:
    - `apps/api/src/main/java/com/watchlog/api/service/LogService.java:132` (`rating`)
    - `apps/api/src/main/java/com/watchlog/api/service/LogService.java:133` (`note`)
    - `apps/api/src/main/java/com/watchlog/api/service/LogService.java:134` (`ott`)
    - `apps/api/src/main/java/com/watchlog/api/service/SyncService.java:266`~`apps/api/src/main/java/com/watchlog/api/service/SyncService.java:277` (sync update도 동일)
- 영향:
  - 사용자가 평점/메모/플랫폼을 지워도 서버에는 기존 값이 남고, 이후 pull 시 되돌아올 수 있음
- 권장 조치:
  - PATCH 계약을 `nullable` 필드 명시 방식으로 재정의
  - 예: `{"note": null}`은 실제 `setNote(null)`으로 처리하도록 분기

### 5) Medium: CSV Export에 Formula Injection 방어 없음
- 근거:
  - `apps/web/lib/export.ts:38`~`apps/web/lib/export.ts:42` (`escapeCsv`는 따옴표 이스케이프만 처리)
- 영향:
  - `=`, `+`, `-`, `@`로 시작하는 셀 값이 엑셀에서 수식으로 실행될 수 있음
- 권장 조치:
  - 해당 패턴 시작 시 `'` prefix 적용 (예: `'=HYPERLINK(...)`)

### 6) Medium: 품질 게이트(린트) 붕괴 상태
- 근거:
  - `npm run lint --workspace ott` 실패, 진단 100+ (`apps/web/app/globals.css`, `apps/web/app/layout.tsx` 등)
- 영향:
  - 스타일/정렬/잠재 버그 신호가 누적되어 회귀 탐지가 어려움
- 권장 조치:
  - `biome` 규칙 기준 정리 후 CI 필수 게이트로 복구
  - 레트로 스타일용 `!important` 예외는 제한된 스코프에만 허용 규칙 분리

### 7) Medium: 백엔드 자동 테스트가 사실상 부재
- 근거:
  - `apps/api/src/test/java/com/watchlog/api/WatchlogApiApplicationTests.java:9` (`contextLoads`만 존재)
- 영향:
  - 동기화/병합/권한/업데이트 회귀를 사전에 잡기 어려움
- 권장 조치:
  - 최소 우선순위 테스트:
    - `sync pull/push` 권한 검증
    - 로그 PATCH null-clear 동작
    - 책 저장/검색(NAVER) 경로

## 우선순위 대응 제안
1. 비밀정보 회전 + 저장소 정리(Critical)
2. 로그/동기화 API 인증 강제(Critical/High)
3. PATCH null-clear 계약 확정 및 서버 반영(High)
4. CSV 수식 주입 방어 + 린트/테스트 게이트 복구(Medium)
