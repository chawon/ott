# agents.md

## 목적
이 문서는 ChatGPT Codex(에이전트)에게 현재까지 구현/결정된 내용과 프로젝트 구조, API 계약, 다음 작업(TODO)을 한 번에 전달하기 위한 안내서다.

## 현재 목표
1) “OTT 시청 기록 서비스” MVP 구현
2) 추천 기능은 당장 제거(의미가 없어서 UX에서 제외)
3) 기록(로그)에 TPO(Time/Place/Occasion)까지 포함해 “나중에 다시 보는 가치”를 높임
4) 동일 작품/시리즈를 계속 보면서 상태가 바뀌는 흐름을 지원하기 위해 “업데이트 + 히스토리”를 추가하고, 상세 페이지에서 보여주고 싶음

---

## 프론트엔드(Next.js)
### 상태
1) Next.js App Router 기반
2) 백엔드(Spring) API를 `/api/*`로 프록시하도록 rewrites 사용
3) TMDB 검색 결과를 UI에서 포스터/기본정보와 함께 표시 가능
4) QuickLogCard에서 기록 저장 성공 시 홈/타임라인 카드 즉시 추가 + 토스트 표시 구현됨
5) 추천 메뉴는 헤더에서 제거, 홈 레이아웃에 추천 영역 없음(단, `/recommendations` 라우트는 남아 있음)
6) 로컬 우선(Local-first) 캐시/쓰기 도입 (Dexie + outbox)
7) 공개 글감/댓글(같이 기록) + 멘션 기능 적용
8) 페어링 코드 기반 로그인(개인정보 없음) 적용
9) 평점은 3단계 라벨(최고/그럭저럭/실망)로 선택
10) 레트로 UI 토글(헤더 아이콘) 및 레트로 전용 홈 레이아웃 지원
11) 시리즈 선택 시 시즌/에피소드 선택 및 시즌 포스터/연도 반영
12) 플랫폼(OTT) 드롭다운 + 직접 입력 + 내 입력 목록 노출
13) 홈 QuickLog 접기/펼치기 지원
14) 헤더/주요 섹션 라벨 아이콘 정렬 및 모바일 헤더 한 줄 정렬
15) 공유 카드 만들기(서버 렌더 OG) + 체크박스로 조건부 오픈

### 주요 파일
1) `next.config.ts`
    1. `/api/:path*` → `${BACKEND_URL}/api/:path*` 리라이트
2) `.env.local`
    1. `BACKEND_URL=http://localhost:8080`
3) `lib/api.ts`
    1. `api<T>(path)` 형태로 호출 (내부적으로 `/api${path}`로 fetch)
4) `lib/types.ts`
    1. WatchLog / Title / TitleSearchItem / Place / Occasion 등 타입 정의
5) `components/TitleSearchBox.tsx`
    1. `/api/titles/search?q=...` 호출
    2. debounce(250ms), Enter로 첫 항목 선택, Escape로 닫기
    3. 포스터/연도/타입/overview(요약) 표시
6) `components/QuickLogCard.tsx`
    1. TitleSearchItem 선택 후 기록 저장
    2. Place/Occasion 선택(기본 HOME/ALONE)
    3. 저장 성공 시 토스트("Saved ✓") + 입력 초기화 + 홈 로그 즉시 반영
    4. 시리즈 시즌/에피소드 선택, 시즌 포스터/연도 표시
    5. 플랫폼 드롭다운 + 직접 입력 + 내 입력 목록
    6. 공유 카드 만들기 체크박스 추가
7) `components/LogCard.tsx`
    1. watchedAt 우선 표기(없으면 createdAt)
    2. place/occasion 칩 표시
8) `app/page.tsx`
    1. QuickLogCard + Recent logs + 최신 같이 기록 노출
    2. 레트로 모드 분기 UI 포함
    3. QuickLog 접기/펼치기
    4. 공유 카드 체크 시 바텀시트 오픈
9) `app/timeline/page.tsx`
    1. `/api/logs` 기반 로딩
    2. status/ott 필터 UI 적용 (FiltersBar)
10) `components/FiltersBar.tsx`
    1. status/OTT 드롭다운 필터
    2. OTT 내 입력 목록 표시
11) `lib/db.ts`
    1. Dexie 스키마(titles/logs/history/outbox)
12) `lib/localStore.ts`
    1. 로컬 저장/조회 + outbox 큐 관리
13) `lib/sync.ts`
    1. outbox 처리(오프라인→온라인 자동 동기화)
14) `components/SyncWorker.tsx`
    1. online/visibilitychange 시 syncOutbox 트리거
15) `components/CommentsPanel.tsx`
    1. 공개 댓글 + 멘션 UI
    2. 댓글 수 표기 문구(“n개의 이야기들”)
16) `app/public/page.tsx`, `app/public/[id]/page.tsx`
    1. 같이 기록 목록/상세
17) `app/account/page.tsx`
    1. 페어링 코드 확인/연결
    2. 라벨 아이콘(설정)
18) `app/recommendations/page.tsx`
    1. 삭제됨 (추천 기능 정리)
19) `context/RetroContext.tsx`
    1. 레트로 모드 토글 상태 관리
20) `components/AppHeader.tsx`
    1. 모바일 1줄 메뉴 정렬
    2. 레트로 라벨 축약(맞추기)
21) `components/ShareBottomSheet.tsx`
    1. 공유 카드 미리보기/다운로드/공유
    2. 서버 렌더 이미지(`/og/share-card`) 사용
22) `app/og/share-card/route.tsx`
    1. 공유 카드 이미지 생성(1080x1920)
    2. 포스터 70% + 텍스트 패널 30%
23) `lib/share.ts`
    1. 공유 카드 이미지 요청/공유 유틸

### Next 15 params 이슈 해결
1) `params.id` 직접 접근 시 “params is a Promise” 경고/에러 발생
2) 클라이언트 컴포넌트에서는 `useParams()`로 해결 완료
3) 상세 페이지는 `"use client"` + `useParams()` 방식으로 동작하도록 구성

---

## 백엔드(Spring Boot + JPA + PostgreSQL)
### 핵심 결정
1) 작품 검색은 내부 DB가 아니라 외부 메타데이터(TMDB) 기반
2) DB에는 “검색 인덱스”가 아니라 “사용자가 저장한 작품 스냅샷”만 유지
3) 기록 저장 시
    1. TMDB provider/providerId로 titles upsert
    2. watch_logs 생성
4) 추천 API는 프론트/백엔드 모두 제거 완료

### TMDB 연동
1) 설정
    1. `tmdb.base-url=https://api.themoviedb.org` (호스트까지만)
    2. 실제 호출 path는 항상 `/3/...`
    3. `TMDB_ACCESS_TOKEN` 환경변수 필요 (Bearer 토큰)
2) 이슈 및 해결
    1. 한글/공백 검색 시 400 → URI 인코딩 처리로 해결
    2. openresty 404 → baseUrl과 path 결합 방식 문제로 `/3`가 누락되던 케이스, uriBuilder로 `/3/search/multi` 고정하여 해결
3) 구현 방식(중요)
    1. `RestClient` 사용
    2. `rest.get().uri(uriBuilder -> uriBuilder.path("/3/search/multi")...build())` 형태로 조립(쿼리 인코딩 자동)

### 데이터 모델(현재 반영된 것)
1) titles
    1. provider/provider_id 컬럼 추가
    2. unique(provider, provider_id) 인덱스
2) watch_logs
    1. rating은 PostgreSQL numeric과 매핑 안정성을 위해 엔티티에서는 BigDecimal 사용
    2. TPO 추가
        1. watched_at (timestamptz, default now)
        2. place (enum string)
        3. occasion (enum string)

### Watch Logs 조회 쿼리
1) Postgres에서 `lower(bytea)` 같은 오류가 발생했던 적이 있음
2) 최종적으로 ILIKE 사용 및 스키마/컬럼 타입 정합성 조정으로 해결
3) 현재는 repository query에서
    1. `coalesce(w.ott, '') ilike concat('%', :ott, '%')`
    2. order by watchedAt desc

---

## API 계약(현재 사용 중/계획)
### Titles
1) `GET /api/titles/search?q=...`
    1. TMDB 기반 검색
    2. 응답: `TitleSearchItemDto[]`
        1. provider: "TMDB"
        2. providerId: string
        3. type: movie | series
        4. name, year, posterUrl, overview
2) `GET /api/titles/{uuid}`
    1. DB에 저장된 title 스냅샷 반환(내부 UUID 기반)
    2. provider/providerId 포함(시즌/에피소드 조회용)

### Logs
1) `GET /api/logs?limit=&status=&ott=&place=&occasion=`
    1. 타임라인/홈에서 사용
2) `POST /api/logs`
    1. TMDB 기반 저장 시 요청 예시
        1. provider="TMDB"
        2. providerId="12345"
        3. titleType="movie"|"series"
        4. status/rating/note/ott/place/occasion
    2. 서버 동작
        1. titles upsert(provider/providerId 기반)
        2. watch_logs 생성
3) `PATCH /api/logs/{id}`
    1. 상태/평점/노트/OTT/TPO 업데이트 지원 (추가/정리 필요)
4) `GET /api/logs?titleId={uuid}&limit=1`
    1. 상세 화면에서 해당 작품의 “내 로그” 불러오기용
    2. repository/query에 titleId 필터 반영 완료
5) 로그 추가 필드
    1. seasonNumber, episodeNumber, seasonPosterUrl, seasonYear (시리즈 시즌/에피소드 기록용)

### Discussions/Comments (같이 기록)
1) `GET /api/discussions?titleId=...`
    1. 해당 작품의 공개 글감 조회(없으면 null)
2) `POST /api/discussions`
    1. titleId 기반 글감 생성/보장
3) `GET /api/discussions/latest?limit=&minComments=&days=`
    1. 최신 글감 목록
    2. days= 최근 N일 내 생성된 글감만
    3. minComments= 댓글 수 필터(옵션)
4) `GET /api/discussions/all?limit=`
    1. 전체 글감 목록
5) `GET /api/discussions/{id}`
    1. 글감 상세(목록 카드용 데이터)
6) `GET /api/discussions/{id}/comments?limit=`
    1. 댓글 목록
7) `POST /api/discussions/{id}/comments`
    1. 댓글 작성(mentions 포함 가능)
    2. syncLog=false 시 댓글 작성으로 내 로그/히스토리 동기화 생략

### TMDB 보조 API (시즌/에피소드)
1) `GET /api/tmdb/tv/{providerId}/seasons`
    1. 시즌 목록(시즌 번호/이름/에피소드 수/포스터/연도)
2) `GET /api/tmdb/tv/{providerId}/seasons/{seasonNumber}`
    1. 에피소드 목록(번호/이름)

### Auth (페어링 코드)
1) `POST /api/auth/register`
    1. userId/deviceId/pairingCode 발급
2) `POST /api/auth/pair`
    1. code 입력으로 기기 연결
    2. oldUserId 전달 시 계정 병합(LWW)

---

## TPO 정의(프론트/백엔드 동일)
1) Place enum
    1. HOME, THEATER, TRANSIT, CAFE, OFFICE, ETC
2) Occasion enum
    1. ALONE, DATE, FAMILY, FRIENDS, BREAK, ETC
3) watchedAt
    1. MVP에서는 기본값 now
    2. 추후 UI에서 날짜 수정 옵션 추가 가능

---

## 추천 제거 결정
1) 프론트에서
    1. Recommendations 메뉴 제거
    2. `/recommendations` 라우트는 아직 남아 있음(헤더에서 미노출)
    3. 홈에서 RecoShelf 관련 div/그리드 제거
2) 백엔드 추천 API 제거 완료

---

## 다음 작업(TODO): “상태 업데이트 + 히스토리 + 상세 표시”
현재 구현 완료(백엔드 + 프론트 반영).
요구사항
1) 동일 작품/시리즈를 계속 보는 경우
    1. 상태가 바뀜(IN_PROGRESS → DONE 등)
    2. 이 변경을 업데이트할 수 있어야 함
    3. 변경 이력을 히스토리로 남겨야 함
    4. 상세 화면에서 현재 상태 + 히스토리 타임라인을 보여주고 싶음

제안 설계(권장)
1) watch_log_history 테이블 추가
    1. log_id FK, recorded_at
    2. status/rating/note/ott/spoiler/watchedAt/place/occasion 스냅샷 저장
2) LogService에서
    1. create 후 history snapshot 1개 기록
    2. update 후에도 snapshot 기록
3) API 추가
    1. `GET /api/logs/{id}/history?limit=...`
4) 상세 화면 동작
    1. title(uuid) 상세 진입
    2. `GET /api/logs?titleId={uuid}&limit=1`로 내 로그 조회
    3. 내 로그가 있으면 폼으로 PATCH 업데이트 제공
    4. 업데이트 후 `GET /api/logs/{logId}/history`로 타임라인 표시

---

## 로컬 우선(Local-first) 진행 상황
### 완료
1) Dexie 기반 로컬 캐시(titles/logs/history/outbox)
2) 로컬 먼저 렌더 → 서버 갱신 흐름(Home/Timeline/Title)
3) 오프라인 생성/수정 시 outbox 등록 + 온라인 전환 시 자동 동기화
4) 동기화 성공 시 UI 자동 갱신 이벤트 적용
5) Sync API(pull/push) 연동 완료

### 미완료(다음 단계)
1) 삭제 동기화(tombstone) + 복구 UX
2) 사용자 식별 보강(기기 목록/세션 관리)
3) 히스토리 동기화 범위 확장
4) 복구 코드(페어링 코드) UX/보안 정책 확정
    1. 브라우저 초기화 시 복구를 위해 코드 입력 방식 검토
    2. 유출 위험 때문에 코드 길이/만료/재발급/기기 승인 등 보안 강화 옵션 논의 필요

---

## 서버 Sync API 설계(초안, LWW)
### 데이터 모델(서버)
1) `watch_logs`
    1. `updated_at`, `deleted_at` 추가
2) `titles`
    1. `updated_at`, `deleted_at` 추가
3) (옵션) `watch_log_history`도 동일 정책 적용

### Push
`POST /api/sync/push`
1) 요청 예시
```
{
  "deviceId": "uuid",
  "clientTime": "2025-01-01T10:00:00Z",
  "changes": {
    "logs": [
      {
        "id": "uuid",
        "op": "upsert",
        "updatedAt": "2025-01-01T09:59:00Z",
        "payload": { ... }
      }
    ],
    "titles": [
      {
        "id": "uuid",
        "op": "upsert",
        "updatedAt": "2025-01-01T09:58:00Z",
        "payload": { ... }
      }
    ]
  }
}
```
2) 서버 동작
    1. `updated_at` 비교(LWW)로 최신만 반영
    2. 오래된 변경은 reject
3) 응답 예시
```
{
  "accepted": ["uuid1", "uuid2"],
  "rejected": [{ "id": "uuid3", "reason": "stale" }]
}
```

### Pull
`GET /api/sync/pull?since=...`
1) 응답 예시
```
{
  "serverTime": "2025-01-01T10:01:00Z",
  "changes": {
    "logs": [ { ... } ],
    "titles": [ { ... } ]
  }
}
```
2) 서버 동작
    1. `updated_at > since` 또는 `deleted_at > since` 항목 반환

### 충돌 정책
1) 서버에서 LWW 기준으로 반영
2) 클라이언트는 push 실패(stale) 시 pull 후 서버 값으로 덮어쓰기
3) lastSyncAt 체크포인트를 클라이언트에 저장

---

## 개발 환경 메모
1) 프론트는 Windows에 설치된 Next.js (또는 WSL에서 dev 실행)
2) 백엔드는 Spring Boot + PostgreSQL
3) TMDB 검색은 서버가 TMDB로 호출(키는 서버 환경변수로 관리)
4) 프론트에서 TMDB 직접 호출하지 않음(키 노출 방지)

---

## 체크리스트(현재 완료/미완료)
완료
1) TMDB 검색 UI + 포스터 표시
2) 한글/공백 검색 정상 동작
3) 기록 저장 POST 동작 + 홈/타임라인 즉시 반영
4) TPO(Place/Occasion, watchedAt 기본값) 저장 및 카드 표시
5) 추천 메뉴 제거 및 홈 레이아웃 정리(추천 페이지 라우트는 잔존)
13) 레트로 모드 토글/전용 홈 레이아웃
6) PATCH /api/logs/{id} 업데이트 + 상세 페이지 연결
7) 히스토리 테이블/엔티티/서비스/컨트롤러 추가 및 상세 표시
8) titleId 필터 기반 로그 조회 API 지원(상세용)
9) 로컬 우선 캐시 + 오프라인 쓰기(outbox) 적용
10) 공개 글감(같이 기록) + 댓글/멘션 기능
11) 페어링 코드 로그인 + 계정 병합
12) 평점 3단계 라벨/이모지 적용
14) 시리즈 시즌/에피소드 선택 + 시즌 포스터/연도 저장/표시
15) 플랫폼 드롭다운 + 직접 입력 + 내 입력 목록
16) 타임라인 OTT 필터 드롭다운
17) 서버 status 필터 정상화 (enum 문자열 비교)
18) 홈 QuickLog 접기/펼치기
19) 홈/타임라인/공개/계정 라벨 아이콘 정리
20) 함께 기록 댓글 노출 문구 정리(“n개의 이야기들”)
21) 홈/검색 미리보기 최신 같이 기록은 댓글 1개 이상만 표시
22) 공유 카드(Share Card) MVP 구현 완료
    1. 1080×1920 (Story) 규격 이미지 생성 (vercel/og 기반)
    2. 포스터 주요 색상 추출 및 배경 자동 적용 (fast-average-color-node)
    3. 레트로 모드 전용 폰트(Galmuri11) 및 테마 적용
    4. 이미지 저장 및 Web Share API 연동
23) PWA 기능 통합 완료
    1. 설치 유도 배너(`PwaInstallBanner`) 추가 (iOS/Android 분기)
    2. 서비스 워커(`sw.js`) 캐싱 전략 적용
    3. `manifest.ts` 및 `layout.tsx` 연동
24) 함께 기록 공유는 체크 시에만 생성 + 댓글 생성 시 로그/히스토리 중복 방지
    1. QuickLog 공유 댓글은 syncLog=false
    2. /discussions/latest에 days 필터 및 최신 댓글 기준 정렬 반영

미완료(바로 진행)
1) 삭제 동기화 및 복구
2) 사용자 기기 목록/해제
3) 복구 코드(페어링 코드) 입력 UX + 보안 정책 결정

---

## 추후 계획: 서비스 노출 및 이용 강화
### 1) [노출/유입] 링크 미리보기 강화 (Dynamic Open Graph)
- **목적**: 공유된 링크의 클릭률(CTR) 극대화
- **내용**: `/public/[id]` 상세 페이지 공유 시, 기존 공유 카드 생성 로직(`/og/share-card`)을 활용하여 메타 태그의 `og:image`를 동적으로 생성/제공
- **기대 효과**: 카카오톡, 트위터 등에서 텍스트 링크가 아닌 시각적인 "카드"로 노출되어 외부 유입 유도

### 2) [이용/재미] "나의 필모그래피" (통계/대시보드)
- **목적**: 기록의 가치를 높여 리텐션(재방문) 유도
- **내용**: 월별/연도별 시청 데이터 시각화 리포트 제공
    - 월별 시청량 및 상태 분포 (DONE/WISHLIST 등)
    - 가장 많이 이용한 플랫폼(OTT) 순위
    - 주로 시청하는 TPO (장소/누구와) 분포
    - 개인별 선호 장르 및 평점 분포
- **기대 효과**: 사용자가 자신의 시청 기록을 하나의 "자산"으로 느끼게 하여 지속적인 기록 동기 부여

---

## 새 작업 제안: 시리즈 시즌/에피소드 선택
요구사항
1) QuickLog에서 시리즈 선택 시 시즌/에피소드 선택 UI 노출
2) 선택하지 않으면 현재처럼 저장
3) 선택하면 시즌/에피소드 정보가 로그에 저장 및 표시

설계 방향(초안)
1) 백엔드
    1. watch_logs 및 watch_log_history에 season_number, episode_number, episode_name?, season_poster_url? 등 컬럼 추가
    2. Create/Update/Sync DTO에 필드 추가
    3. TMDB TV 상세/시즌 상세 조회 API 추가 (시즌 목록/썸네일)
2) 프론트
    1. QuickLogCard에서 series 선택 시 시즌/에피소드 dropdown
    2. TMDB 시즌 목록 호출 (/api/titles/{providerId}/seasons 등)
    3. 선택된 시즌/에피소드가 카드/타임라인/상세/히스토리에 표시
3) 로컬 캐시/Sync
    1. Dexie/LocalStore에도 필드 보존
    2. Outbox payload에도 season/episode 포함
