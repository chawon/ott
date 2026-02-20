# AGENTS.md

## 1) 문서 목적
이 문서는 Codex(에이전트)가 바로 실행 가능한 상태로 일하기 위한 운영 가이드다.
핵심은 아래 3가지를 항상 고정하는 것이다.

1. 현재 상황(What is true now)
2. 이번 목표(What to do next)
3. 개발 룰(How to do it safely)

과거 이슈 회고/긴 논의는 이 문서에 누적하지 않는다. 필요한 경우 `docs/`에 별도 문서로 남긴다.

---

## 2) 프로젝트 스냅샷 (기준일: 2026-02-19)

### 아키텍처
1. 모노레포
   1. 프론트: `apps/web` (Next.js App Router)
   2. 백엔드: `apps/api` (Spring Boot + JPA + PostgreSQL)
2. 프론트는 `/api/*`를 백엔드로 프록시(rewrite)한다.
3. 외부 메타데이터 검색은 TMDB를 백엔드에서만 호출한다(키 노출 방지).

### 이미 제품에 반영된 큰 기능
1. QuickLog 저장 + 홈/타임라인 즉시 반영
2. TPO 저장(`watchedAt`, `place`, `occasion`)
3. 로그 업데이트(PATCH) + 히스토리 타임라인 표시
4. 시리즈 시즌/에피소드 선택 및 기록 필드 반영
5. 로컬 우선(Local-first) 캐시 + Outbox + Sync(pull/push)
6. 공개 글감/댓글/멘션(같이 기록)
7. 페어링 코드 기반 로그인 및 계정 연결
8. 공유 카드(OG 서버 렌더 + 공유/다운로드)
9. PWA(설치 배너, SW, manifest)

### 제품 방향
1. 추천 기능은 현재 범위에서 제외한다.
2. 기록 가치(회상, 공유, 재방문)를 높이는 기능에 집중한다.

---

## 3) 이번 사이클 목표 (우선순위 고정)

### P0
1. 삭제 동기화(tombstone) + 복구 UX
2. 복구 시 충돌/중복 없이 로컬-서버 상태 일치

### P1
1. 사용자 기기 목록/해제 UX 마무리
   1. 백엔드 API는 존재 (`GET /api/auth/devices`, `DELETE /api/auth/devices/{id}`)
   2. 프론트 관리 화면 완성 및 검증 필요

### P1
1. 복구 코드(페어링 코드) 입력 UX + 보안 정책 확정
2. 최소 보안 정책
   1. 코드 길이/만료
   2. 재발급 규칙
   3. 신규 기기 승인/해제 흐름

---

## 4) Codex 개발 룰

### 공통 원칙
1. 탐색 후 수정: 먼저 코드/스키마/계약을 확인하고 편집한다.
2. 단일 변경 목적: 이번 작업 목표 외 리팩터링은 묶지 않는다.
3. 기존 사용자 변경사항 존중: 관련 없는 로컬 변경을 되돌리지 않는다.
4. 충돌 없는 문서 유지: 완료/미완료/계획이 한 항목에서 모순되지 않게 쓴다.

### 브랜치/문서화 원칙
1. 기능 개발은 기본적으로 전용 브랜치에서 시작한다.
2. 구현 전에 설계와 개발 방향(범위, API/스키마 영향, 검증 시나리오)을 문서화한다.
3. 구현 중 결정 변경이 생기면 문서를 즉시 갱신해 최종 결정과 코드가 일치하도록 유지한다.

### 계약/스키마 변경 원칙
1. 로그/타이틀 필드가 바뀌면 아래를 함께 업데이트한다.
   1. 백엔드: Entity, DTO, Service, Controller, Migration, Sync DTO
   2. 프론트: `lib/types.ts`, Dexie(`lib/db.ts`), localStore, outbox payload, UI
2. API 계약이 바뀌면 프론트 호출부와 문서를 같은 PR에서 맞춘다.
3. 하위 호환 불가 변경은 금지한다. 필요 시 단계적 마이그레이션으로 처리한다.

### Local-first / Sync 원칙
1. 쓰기 흐름: 로컬 반영 -> outbox 적재 -> 서버 동기화
2. 충돌 정책: LWW(서버 우선)
3. stale reject 발생 시: pull 후 서버 값 기준으로 재적용
4. `lastSyncAt` 체크포인트를 기준으로 증분 pull 한다.

### 품질 원칙
1. 기능 변경 시 최소한 아래를 확인한다.
   1. 생성(create), 수정(update), 목록(list), 상세(detail), 동기화(sync)
   2. 온라인/오프라인 전환
   3. 히스토리 누락/중복 여부
2. UI 변경 시 모바일 레이아웃 깨짐 여부를 함께 확인한다.
3. 검증 기본 커맨드는 루트 기준 `npm run test`, `npm run lint`를 사용한다.

---

## 5) 활성 API 계약 (현재 기준)

### Titles
1. `GET /api/titles/search?q=...`
   1. TMDB 기반 검색
   2. 응답: `provider`, `providerId`, `type(movie|series)`, `name`, `year`, `posterUrl`, `overview`
2. `GET /api/titles/{id}`
   1. 내부 UUID title 스냅샷 반환

### Logs
1. `GET /api/logs?limit=&status=&origin=&ott=&place=&occasion=&titleId=`
2. `POST /api/logs`
3. `PATCH /api/logs/{id}`
4. `GET /api/logs/{id}/history?limit=`
5. 로그 주요 필드
   1. `status`, `rating`, `note`, `ott`, `watchedAt`, `place`, `occasion`
   2. `seasonNumber`, `episodeNumber`, `seasonPosterUrl`, `seasonYear`

### TMDB 보조 API
1. `GET /api/tmdb/tv/{providerId}/seasons`
2. `GET /api/tmdb/tv/{providerId}/seasons/{seasonNumber}`

### Discussions / Comments
1. `GET /api/discussions?titleId=...`
2. `POST /api/discussions`
3. `GET /api/discussions/latest?limit=&minComments=&days=`
4. `GET /api/discussions/all?limit=`
5. `GET /api/discussions/{id}`
6. `GET /api/discussions/{id}/comments?limit=`
7. `POST /api/discussions/{id}/comments`

### Auth
1. `POST /api/auth/register`
2. `POST /api/auth/pair`
3. `GET /api/auth/devices`
4. `DELETE /api/auth/devices/{id}`

### Analytics
1. `POST /api/analytics/events`
   1. 익명 방문도 수집 가능
   2. 헤더: `X-Client-Id`(optional), `X-User-Id`(optional)
2. `GET /api/analytics/me/report`
   1. 헤더: `X-User-Id` 필요

### Sync
1. `POST /api/sync/push`
2. `GET /api/sync/pull?since=...`

---

## 6) 데이터 모델 핵심 합의
1. `titles`
   1. `provider`, `provider_id` 기반 upsert
   2. `unique(provider, provider_id)`
2. `watch_logs`
   1. 사용자의 최신 상태 레코드
   2. TPO + 시즌/에피소드 관련 필드 포함
3. `watch_log_history`
   1. create/update 시점 스냅샷 누적
   2. 상세 화면 타임라인의 진실 원천

---

## 7) 작업 시작 전 빠른 체크
1. 이번 작업이 P0/P1 어디에 속하는지 확인
2. 영향 범위가 API/DB/Sync/UI 중 어디까지인지 먼저 선언
3. 변경 후 검증 시나리오를 최소 3개 이상 준비

---

## 8) 작업 완료 기준 (Definition of Done)
1. 기능이 목표 시나리오에서 실제 동작
2. 관련 API/타입/로컬캐시/동기화 경로 정합성 확보
3. 기존 기능 회귀 없음(특히 QuickLog, Timeline, Title detail, Sync)
4. 검증 커맨드 통과
   1. `npm run test`
   2. `npm run lint`
5. 문서 최신화
   1. API/룰 변경 시 본 파일 업데이트
   2. 장문 설계/회고는 `docs/`로 분리

---

## 9) 진실 원천 경로 (Source of Truth)

### 프론트
1. API 유틸: `apps/web/lib/api.ts`
2. 타입: `apps/web/lib/types.ts`
3. 로컬 DB: `apps/web/lib/db.ts`
4. 로컬 저장소: `apps/web/lib/localStore.ts`
5. 동기화: `apps/web/lib/sync.ts`
6. 핵심 입력 UI: `apps/web/components/QuickLogCard.tsx`
7. 타임라인: `apps/web/app/timeline/page.tsx`
8. 상세: `apps/web/app/title/[id]/page.tsx`

### 백엔드
1. 로그 API: `apps/api/src/main/java/com/watchlog/api/web/LogController.java`
2. 인증 API: `apps/api/src/main/java/com/watchlog/api/web/AuthController.java`
3. 동기화 API: `apps/api/src/main/java/com/watchlog/api/web/SyncController.java`
4. TMDB API: `apps/api/src/main/java/com/watchlog/api/web/TmdbController.java`
5. 로그 서비스: `apps/api/src/main/java/com/watchlog/api/service/LogService.java`
6. 마이그레이션: `apps/api/src/main/resources/db/migration/`

---

## 10) 문서 운영 룰
1. "완료"와 "다음 작업"을 같은 항목에 동시에 적지 않는다.
2. 폐기된 제안/중복 이력은 본문에서 제거하고 필요하면 `docs/archive/`로 이동한다.
3. 우선순위는 P0/P1/P2로만 관리한다.
4. 이 파일은 "현재 실행 지침"만 유지한다.
