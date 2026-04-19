# AGENTS.md

## 1) 문서 목적
이 문서는 Codex(에이전트)가 바로 실행 가능한 상태로 일하기 위한 운영 가이드다.
핵심은 아래 3가지를 항상 고정하는 것이다.

1. 현재 상황(What is true now)
2. 이번 목표(What to do next)
3. 개발 룰(How to do it safely)

과거 이슈 회고/긴 논의는 이 문서에 누적하지 않는다. 필요한 경우 `docs/`에 별도 문서로 남긴다.

---

## 2) 프로젝트 스냅샷 (기준일: 2026-04-19)

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
10. 다국어 지원(i18n): ko, en 전면 지원 및 TMDB 데이터 연동
11. 사용자 문의함 + 관리자 문의 답변 화면 기본 흐름 구현
12. 신규 문의 등록 시 Telegram 알림 전송(환경변수 설정 시 활성화)
13. 기기 unlink 후 서버 API 차단 + 로컬 캐시 초기화 적용
14. Next.js 16 대응 `middleware` -> `proxy` 전환 완료
15. ottline 브랜딩 전면 적용: 신규 아이콘/파비콘, 헤더 로고, 브랜드명, 슬로건, OG 이미지, 공유카드 watermark
16. 관리자 analytics에 마이그레이션 현황 + 구 도메인 잔존 사용(`oldDomainUsage`) 표시
17. 낙장불입 정책 확정: 사용자용 개별 기록 삭제 없음, 설정의 로컬 초기화와 서버 데이터 전체 삭제를 분리
18. 설정에서 계정 단위 서버 데이터 전체 삭제(기록/댓글/문의/analytics/기기 연결) 지원

### 제품 방향
1. 추천 기능은 현재 범위에서 제외한다.
2. 기록 가치(회상, 공유, 재방문)를 높이는 기능에 집중한다.
3. 글로벌 서비스 확장을 위해 모든 UI/데이터는 다국어 대응을 기본으로 한다.
4. 사용자용 개별 기록 삭제는 제공하지 않는다. 기록 정정은 수정과 히스토리로 관리한다.

---

## 3) 이번 사이클 목표 (우선순위 고정)

### 완료
1. **다국어(i18n) 및 글로벌 서비스화**: `next-intl` 적용, 전체 UI 번역, 백엔드 데이터 연동 완료.
2. **도메인 이전 및 마이그레이션**: `ottline.app` 신규 도메인 연결 및 리다이렉트 기반 인증 정보 이식 완료.
3. **ottline 브랜딩 적용 (Phase 2)**: 아이콘/파비콘 교체, 헤더 로고(텍스트 조합), 레트로 모드 제거, 브랜드명·슬로건·OG이미지·공유카드 watermark 전면 반영 완료.
4. **마이그레이션 현황 추적**: `migration_complete` 이벤트 서버 적재, `/api/admin/analytics/migration-status` 엔드포인트 추가, admin 페이지 마이그레이션 현황 섹션 표시.
5. **도메인별 접속 분석**: `app_open` 이벤트에 `hostname` 프로퍼티 추가, admin 통계에 domain(hostname) 세그먼트 표시.
6. **구 도메인 잔존 사용 지표 분리**: admin analytics overview에 `oldDomainUsage` 응답 추가, `login_success`·`log_create`·`share_action`·`known user`를 old domain 기준으로 분리 표시.
7. **구 도메인 301 전환 완료**: `2026-04-18`부터 `ott.preview.pe.kr/*`는 Cloudflare에서 `https://ottline.app/*`로 301 리다이렉트한다. 기존 MigrationBanner 기반 자발적 이전 유도는 종료했다.
8. **레트로 모드 통계 제거**: admin analytics에서 retro 관련 섹션(레트로 현황, 주간 레트로 트렌드) 제거. `SyncWorker`의 `app_open` 이벤트에서 `isRetro` 프로퍼티 제거.
9. **브라우저 확장 ottline 브랜딩 및 스토어 배포**: `manifest.json`, `popup.html`, `popup.js` 브랜드명·URL을 ottline으로 전환, 아이콘 교체(512px 원본 리사이즈), Chrome Web Store/Edge Add-ons Store 배포 완료.
10. **Microsoft Store PWA 배포**: PWABuilder 기반 Windows 패키지 인증 심사 통과 및 배포 완료. 브랜드명 `On the Timeline` 기준.
11. **설정의 서버 데이터 전체 삭제 추가**: `DELETE /api/auth/account` 기반으로 계정 단위 서버 기록/댓글/문의/analytics/기기 연결 삭제 지원.

### P1
1. 복구 코드(페어링 코드) 입력 UX + 보안 정책 확정
2. 최소 보안 정책
   1. 코드 길이/만료
   2. 재발급 규칙
   3. 신규 기기 승인/해제 흐름

### P1
1. 문의함 운영 후속 작업
2. 우선 검토
   1. 미답변 필터/카운트
   2. 관리자 답변 알림 여부 결정
   3. 운영 응답 SLA 정리

### P1
1. PC 브라우저 확장 — 배포 후 후속 작업
2. 현재 기준
   1. Chrome Web Store 배포 완료 (`ottline-helper-0.1.0`, 2026-03-26)
   2. Microsoft Edge Add-ons Store 배포 완료 (`ottline-helper-0.1.0`)
   3. Whale Store 제출 완료 (`2026-04-13`), 심사 중
   4. 남은 작업: Netflix 모달 selector 정밀화, 사이트별 캡처 정확도 검증, locale/base URL 설정 페이지 검토

### P1
1. Android 배포 경로 정리
2. 현재 기준
   1. Google Play internal/release 경로는 `apps/twa` 기반 Bubblewrap TWA
   2. 패키지명 `app.ottline`, 도메인 `ottline.app`, 워크플로우는 `twa-debug.yml` / `twa-build-aab.yml` / `twa-release.yml`
   3. `2026-04-18` 기준 Google Play `alpha` 비공개 테스트 시작 (`versionName=1.0.2`, `versionCode=6`)
   4. `feat/native-mobile-app`의 `apps/native`는 React Native + Expo 후보 앱이며, main 미머지 상태이고 배포 파이프라인은 아직 없음

### P1
1. Public repo 보안 후속 정리
2. 현재 기준
   1. `deploy/oke/registry-secret.yaml`, `deploy/oke-staging/registry-secret.yaml`에 OCIR pull secret이 남아 있어 ESO/Vault 기반 관리로 전환 필요
   2. `apps/api/src/main/resources/application-local.yaml`의 TMDB 개발용 토큰은 env 참조로 치환 필요
   3. 문서에 남은 운영 자격증명/토큰 표기는 scrub 필요
   4. 관련 credential 회전 후 git history 정리는 별도 후속 작업으로 처리

---

## 4) 배포 전략

### 브랜치 구조

```
feature/* ──PR──→ main ──→ [자동] staging.ottline.app
                                  ↓
                         GitHub Actions workflow_dispatch
                         (SHA 입력)
                                  ↓
                            ottline.app (프로덕션)
```

| 브랜치 | 용도 | 직접 푸시 |
|---|---|---|
| `main` | 스테이징 자동 배포 트리거 | PR만 |
| `feature/*` | 기능 개발 | ✅ |
| `fix/*` | 버그 수정 | ✅ |
| `hotfix/*` | 긴급 수정 (스테이징 생략 가능) | ✅ |

### 에이전트 작업 규칙

1. **새 작업은 반드시 브랜치 먼저**: 작업 시작 전 `feature/작업명` 또는 `fix/작업명` 브랜치를 만든다.
2. **main 직접 커밋 금지**: main에는 PR(머지)로만 반영한다. 단, 문서·설정 소규모 수정은 예외로 사용자가 명시적으로 허용할 때만 허용.
3. **스테이징 먼저, 프로덕션은 수동**: main 머지 = 스테이징 자동 배포. 프로덕션은 사용자가 직접 `workflow_dispatch`로 수동 트리거.
4. **hotfix 예외**: 긴급 수정은 `hotfix/*` 브랜치에서 main으로 직접 PR 가능. 이때 사용자에게 스테이징 생략 여부를 먼저 확인한다.

### 프로덕션 배포 방법

1. staging 배포 워크플로우 완료 후 **Summary 탭**에서 SHA 복사
2. GitHub Actions → **Deploy Web to Production** / **Deploy API to Production** → `Run workflow`
3. `sha` 입력란에 복사한 SHA 붙여넣기

> SHA를 모를 때: `deploy/oke-staging/{web,api}-deployment.yaml`의 이미지 태그에서 `staging-` 뒤 값이 SHA

### 이미지 태그 규칙

| 환경 | 태그 형식 | 워크플로우 |
|---|---|---|
| 스테이징 | `staging-{full-sha}` | `deploy-web.yml` / `deploy-api.yml` (main push 자동) |
| 프로덕션 | `{full-sha}` | `deploy-web-production.yml` / `deploy-api-production.yml` (수동) |

### 인프라 구성 요약

- **스테이징**: `ott-staging` 네임스페이스, `staging.ottline.app`, Cloudflare Access로 접근 제한
- **프로덕션**: `ott` 네임스페이스, `ottline.app`
- **GitOps**: ArgoCD가 `deploy/oke/`, `deploy/oke-staging/` 디렉토리를 main HEAD에 자동 동기화
- **시크릿 관리**: OCI Vault → ESO (git에 시크릿 실제 값 커밋 절대 금지)
- **TLS**: Cloudflare Origin Certificate (cert-manager/Let's Encrypt 아님)
- **버전 표시**: Footer에 `web {sha} · api {sha}` 형식으로 현재 배포 버전 표시
- **세부 운영 가이드**: `docs/staging-environment-plan.md` 참조

---

## 5) Codex 개발 룰

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

## 6) 활성 API 계약 (현재 기준)

*모든 API는 `Accept-Language` 헤더를 통해 요청자의 언어 선호도를 수신하며, TMDB 등 외부 연동 시 이를 활용한다.*

### Titles
1. `GET /api/titles/search?q=...&type=`
   1. TMDB 기반 검색 (헤더에 따른 다국어 검색 결과 반환)
   2. 도서 검색: Naver 도서 API 사용
   3. 응답: `provider(TMDB|NAVER)`, `providerId`, `type(movie|series|book)`, `name`, `year`, `posterUrl`, `overview`, `author`, `publisher`, `isbn10`, `isbn13`
2. `GET /api/titles/{id}`
   1. 내부 UUID title 스냅샷 반환

### Logs
1. `GET /api/logs?limit=&status=&origin=&ott=&place=&occasion=&titleId=&sort=`
   1. `sort=history`면 `updatedAt`(히스토리 반영 순) 기준 정렬, 기본은 `watchedAt`
2. `POST /api/logs` (헤더에 따른 다국어 타이틀 정보 자동 생성)
3. `PATCH /api/logs/{id}`
4. `GET /api/logs/{id}/history?limit=`
5. 로그 주요 필드
   1. `status`, `rating`, `note`, `ott`, `watchedAt`, `place`, `occasion`, `updatedAt`
   2. `seasonNumber`, `episodeNumber`, `seasonPosterUrl`, `seasonYear`
6. 사용자용 개별 삭제 API는 제공하지 않는다.
   1. 실수한 기록은 `PATCH`로 수정한다.
   2. 설정의 로컬 초기화는 현재 기기 브라우저 저장소만 비운다.
   3. 계정 단위 서버 데이터 전체 삭제는 설정의 별도 액션으로 제공한다.

### TMDB 보조 API
1. `GET /api/tmdb/tv/{providerId}/seasons`
2. `GET /api/tmdb/tv/{providerId}/seasons/{seasonNumber}`
   * (`Accept-Language` 헤더 대응)

### Discussions / Comments
1. `GET /api/discussions?titleId=...`
2. `POST /api/discussions`
3. `GET /api/discussions/latest?limit=&minComments=&days=`
4. `GET /api/discussions/all?limit=`
5. `GET /api/discussions/{id}`
6. `GET /api/discussions/{id}/comments?limit=`
7. `POST /api/discussions/{id}/comments` (멘션된 타이틀 자동 생성 시 다국어 대응)

### Auth
1. `POST /api/auth/register`
2. `POST /api/auth/pair`
3. `GET /api/auth/devices`
4. `DELETE /api/auth/devices/{id}`
5. `DELETE /api/auth/devices/all`
6. `DELETE /api/auth/account`
   1. 현재 계정의 서버 기록, 댓글, 문의, analytics 이벤트, 추천 캐시, 기기 연결을 삭제
   2. 개별 로그 삭제가 아니라 계정 단위 전체 삭제용 엔드포인트
7. 활성 기기 검증
   1. `X-User-Id` + `X-Device-Id` 조합이 유효하지 않으면 `401`
   2. `logs`, `sync`, `feedback`, `analytics`, `auth/devices`, `auth/account`에 적용

### Feedback
1. `GET /api/feedback/threads`
   1. 헤더: `X-User-Id` 필요
   2. 현재 사용자 본인 문의 목록만 반환
2. `POST /api/feedback/threads`
   1. 헤더: `X-User-Id` 필요
   2. 새 문의 스레드 + 첫 메시지 생성
3. `GET /api/feedback/threads/{id}`
   1. 헤더: `X-User-Id` 필요
   2. 본인 문의 상세만 반환
4. `GET /api/admin/feedback/threads?limit=`
   1. 헤더: `X-Admin-Token` 필요
   2. 전체 문의 목록 반환
5. `GET /api/admin/feedback/threads/{id}`
   1. 헤더: `X-Admin-Token` 필요
   2. 관리자용 문의 상세 반환
6. `POST /api/admin/feedback/threads/{id}/reply`
   1. 헤더: `X-Admin-Token` 필요
   2. 관리자 답변 메시지 생성 + 상태를 `ANSWERED`로 변경
7. Telegram 운영 알림
   1. 신규 문의 등록 시만 전송
   2. 설정: `TELEGRAM_NOTIFY_ENABLED`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_SERVICE_NAME`

### Analytics
1. `POST /api/analytics/events`
   1. 익명 방문도 수집 가능
   2. 헤더: `X-Client-Id`(optional), `X-User-Id`(optional)
   3. 이벤트 종류: `app_open`, `login_success`, `log_create`, `share_action`, `migration_complete`
   4. `app_open` properties: `hostname`, `deviceType`, `osFamily`, `browserFamily`, `installState`
2. `GET /api/analytics/me/report`
   1. 헤더: `X-User-Id` 필요
3. `GET /api/admin/analytics/overview?days=`
   1. 헤더: `X-Admin-Token` 필요
   2. 응답에 `oldDomainUsage` 포함 (`appOpenUsers`, `appOpenEvents`, `knownUsers`, `userBoundEvents`, `loginSuccessUsers`, `logCreateUsers`, `shareActionUsers`, `lastSeenAt`, `lastMeaningfulActionAt`, `installStates`, `browserFamilies`)
4. `GET /api/admin/analytics/events?days=&limit=&eventName=&platform=`
   1. 헤더: `X-Admin-Token` 필요
5. `GET /api/admin/analytics/migration-status`
   1. 헤더: `X-Admin-Token` 필요
   2. 응답: `totalActiveUsers`, `migratedUsers`, `notMigratedUsers`, `migrationRate`, `recentMigrations`

### Sync
1. `POST /api/sync/push`
2. `GET /api/sync/pull?since=...`

---

## 7) 데이터 모델 핵심 합의
1. `titles`
   1. `provider`, `provider_id` 기반 upsert
   2. `unique(provider, provider_id)`
2. `watch_logs`
   1. 사용자의 최신 상태 레코드
   2. TPO + 시즌/에피소드 관련 필드 포함
3. `watch_log_history`
   1. create/update 시점 스냅샷 누적
   2. 상세 화면 타임라인의 진실 원천
4. `feedback_threads`
   1. 사용자별 문의 스레드
   2. `category`, `status`, `subject`, `updated_at` 관리
5. `feedback_messages`
   1. 문의 스레드 하위 메시지
   2. `author_role(USER|ADMIN)` 기준으로 작성자 구분

---

## 8) 작업 시작 전 빠른 체크
1. 이번 작업이 P0/P1 어디에 속하는지 확인
2. 영향 범위가 API/DB/Sync/UI 중 어디까지인지 먼저 선언
3. 변경 후 검증 시나리오를 최소 3개 이상 준비

---

## 9) 작업 완료 기준 (Definition of Done)
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

## 10) 진실 원천 경로 (Source of Truth)

### 프론트
1. API 유틸: `apps/web/lib/api.ts`
2. 타입: `apps/web/lib/types.ts`
3. 로컬 DB: `apps/web/lib/db.ts`
4. 로컬 저장소: `apps/web/lib/localStore.ts`
5. 동기화: `apps/web/lib/sync.ts`
6. 핵심 입력 UI: `apps/web/components/QuickLogCard.tsx`
7. 타임라인: `apps/web/app/[locale]/timeline/page.tsx`
8. 상세: `apps/web/app/[locale]/title/[id]/page.tsx`
9. 번역 사전: `apps/web/messages/`

### 백엔드
1. 로그 API: `apps/api/src/main/java/com/watchlog/api/web/LogController.java`
2. 인증 API: `apps/api/src/main/java/com/watchlog/api/web/AuthController.java`
3. 동기화 API: `apps/api/src/main/java/com/watchlog/api/web/SyncController.java`
4. TMDB API: `apps/api/src/main/java/com/watchlog/api/web/TmdbController.java`
5. 로그 서비스: `apps/api/src/main/java/com/watchlog/api/service/LogService.java`
6. 마이그레이션: `apps/api/src/main/resources/db/migration/`

---

## 11) 문서 운영 룰
1. "완료"와 "다음 작업"을 같은 항목에 동시에 적지 않는다.
2. 폐기된 제안/중복 이력은 본문에서 제거하고 필요하면 `docs/archive/`로 이동한다.
3. 우선순위는 P0/P1/P2로만 관리한다.
4. 이 파일은 "현재 실행 지침"만 유지한다.
