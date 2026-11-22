# 공통 API와 데이터 계약

기능 변경을 설계할 때 참조할 API·데이터 계약의 요약이다. 세부 요청·응답과 현재 동작은 [API 컨트롤러](../apps/api/src/main/java/com/watchlog/api/web), DTO, 테스트로 확인한다. 설치된 이전 앱의 계약을 확인할 때는 [플랫폼 현황](platforms.md)의 출시 소스를 기준으로 삼는다.

`Accept-Language`는 언어별 검색과 표시용 메타데이터에 사용된다. 인증 및 기능별 헤더는 아래 각 계약을 따른다.

### Titles
1. `GET /api/titles/search?q=...&type=`
   1. TMDB 기반 검색 (헤더에 따른 다국어 검색 결과 반환)
   2. 도서 검색: 영어 선호(`Accept-Language`의 `en` 및 지역 변형)는 Google Books, 한국어·누락·잘못된 헤더는 Kakao를 사용한다. 같은 ISBN 판본의 기존 NAVER/KAKAO/GOOGLE_BOOKS 식별자를 유지한다. 기존 iOS 바이너리는 Kakao를 유지하고 출처 표시를 지원하는 새 바이너리(`X-Book-Search-Capability: google_books_v1`)부터 영어 검색을 전환한다.
   3. 응답: `provider(TMDB|NAVER|KAKAO|GOOGLE_BOOKS)`, `providerId`, `type(movie|series|book)`, `name`, `year`, `posterUrl`, `overview`, `author`, `publisher`, `isbn10`, `isbn13`, `pubdate`, `titleId`(기존 책이면 UUID, 없으면 null), `sourceUrl`(Google 검색의 원문 링크, 그 외 null). Google의 providerId는 ISBN이 아닌 volume ID다. 설정·배포 상태는 [google-books-en-search.md](google-books-en-search.md)를 따른다.
2. `GET /api/titles/popular?limit=`
   1. TMDB movie/tv 인기 작품을 혼합해 반환한다.
   2. `Accept-Language`에서 language/watch region을 추정하고 공개일·첫 방영일·시청 가능 region을 기준으로 후보를 제한한다.
   3. 한국어(`ko-KR`) fallback은 TMDB 주간 트렌드에서 `original_language=ko` 또는 `origin_country=KR`인 항목만 노출한다.
   4. 한국어 fallback은 필터링 후 부족해지지 않도록 주간 트렌드를 최대 5페이지까지 overfetch한다.
   5. 서버 내부에서 언어/지역별 1일 캐시하며, 홈의 함께 기록 부족분 보충에만 사용한다.
3. `GET /api/titles/{id}`
   1. 내부 UUID title 스냅샷 반환
4. `POST /api/titles/book-classifications/resolve`
   1. 요청: `isbn13s`(유효한 ISBN-13, 배열 최대 50개, 서버에서 중복 제거)
   2. 도서나루 상세 조회의 `class_no`를 KDC 코드로 사용하고 첫 숫자를 0~9 대분류로 정규화한다.
   3. 응답: `isbn13`, `kdcCode`, `kdcMajor`, `status(RESOLVED|NOT_FOUND)`, `fetchedAt`
   4. `RESOLVED`는 서버에 영구 캐시하고 `NOT_FOUND`는 30일 뒤 다시 확인한다.
   5. 도서나루 키 누락 또는 외부 장애는 `503`으로 반환하며, 프론트의 기록 저장과 로컬 서가는 계속 동작한다.

### Logs
1. `GET /api/logs?limit=&status=&origin=&ott=&q=&place=&occasion=&titleId=&sort=`
   1. `sort=history`면 `updatedAt`(히스토리 반영 순) 기준 정렬, 기본은 `watchedAt`
   2. `q`는 제목/메모/플랫폼/도서 저자·출판사 검색에 사용
2. `GET /api/logs/page?limit=&status=&origin=&ott=&q=&place=&occasion=&titleId=&sort=&contentType=&cursor=`
   1. 응답은 `items`와 불투명 `nextCursor`이며, 다음 요청은 같은 필터·정렬과 `cursor`를 사용한다.
   2. `contentType=book|video`를 지원하고 `limit`은 1~100으로 제한한다.
   3. `updatedAt|watchedAt`과 UUID를 함께 쓰는 키셋 페이징으로 같은 시각의 기록도 중복 없이 이어진다.
3. `POST /api/logs` (헤더에 따른 다국어 타이틀 정보 자동 생성)
4. `PATCH /api/logs/{id}`
5. `GET /api/logs/{id}/history?limit=`
6. 로그 주요 필드
   1. `status`, `rating`, `note`, `ott`, `watchedAt`, `place`, `occasion`, `updatedAt`
   2. `seasonNumber`, `episodeNumber`, `seasonPosterUrl`, `seasonYear`
7. 사용자용 개별 삭제 API는 제공하지 않는다.
   1. 실수한 기록은 `PATCH`로 수정한다.
   2. 설정의 로컬 초기화는 해당 클라이언트의 로컬 저장소를 비우는 기능이다. 실제 제공 여부와 정리 경로는 각 앱에서 확인한다.
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
7. `POST /api/discussions/{id}/comments`
   1. 헤더: `X-User-Id`, `X-Device-Id` 필요
   2. 서버는 헤더의 활성 기기를 검증하고, 댓글 작성자는 헤더의 사용자로 확정한다
   3. 멘션된 타이틀 자동 생성 시 다국어 대응
8. `GET /api/discussions/{id}/reactions/me`
   1. 헤더: `X-User-Id`, `X-Device-Id` 필요
   2. 현재 사용자의 해당 공개 글 리액션 선택 상태와 집계를 반환한다
9. `PUT /api/discussions/{id}/reactions`
   1. 헤더: `X-User-Id`, `X-Device-Id` 필요
   2. 요청: `type(DONE|CURIOUS|SAVE)`
   3. 사용자별 공개 글당 1개 리액션만 유지하며, 같은 type 재클릭은 취소한다
   4. `DONE`은 프론트에서 영상 `나도 봤어요`/책 `나도 읽었어요`로 표시한다
   5. 리액션 클릭으로 내 기록을 남기는 동작은 프론트 local-first outbox 경로로 처리한다
10. `DiscussionListItem` 응답에는 트렌드 중복 제거용 `titleProvider`, `titleProviderId`가 포함된다
11. `DiscussionListItem`/`DiscussionDto` 응답에는 `reactionSummary(done, curious, save)`가 포함된다
12. `GET /api/discussions/connection?titleId=`: 기존 활성 기기 헤더로 실제 다른 사용자의 내용 있는 공개 댓글 존재를 확인하고 `{discussionId, titleId}` 또는 `null`을 반환한다. 기존 익명 댓글도 포함하며 누적 `commentSeq`나 200개 목록 제한에 의존하지 않는다. `Cache-Control: private, no-store`인 읽기 전용 조회로 신규 계정·이야기·댓글을 만들지 않는다. 저장 완료 뒤 같은 작품 연결에만 사용하며 실패는 기록 저장에 영향을 주지 않는다. 상세는 [saved-discussion-connection.md](saved-discussion-connection.md)를 따른다.

### Curated contents · 종료 호환 계약

`2026-11-22` main `c693fd8`에 병합한 종료 계약이다. 운영 반영·실제 검증 상태는 [통합 운영 반영 기록](web-api-rollout-2026-11-22.md), 세부 변경 결정은 [큐레이터 종료 변경안](changes/api-curator-retirement-2026-11-22.md)을 따른다.

1. `GET /api/curated-contents?limit=`는 한국어·영어 및 기존 설치 앱에 **HTTP 200 빈 배열 `[]`**을 반환하며 `Cache-Control: no-store`를 사용한다. 기존 게시 자료가 DB에 남아 있어도 공개하지 않는다.
2. 인증된 관리자의 `POST /internal/admin/curated-contents/drafts`, `POST /internal/admin/curated-contents/{id}/publish`, `POST /internal/admin/curated-contents/{id}/disable`는 **410 Gone**을 반환하며 데이터를 변경하지 않는다. 기존 관리자 토큰 검증은 유지한다.
3. 관리자 목록·작품 검색과 내부 이력 조회는 읽기 전용으로 보존한다. 자동 초안 생성·Telegram 승인 수신·게시·재전송 작업은 제공하지 않는다. 문의 알림·데일리 리포트의 일반 Telegram 전송과 스케줄러는 유지한다.
4. 기존 큐레이터·승인·감사 자료, 개인 기록·공개 대화·댓글·반응은 삭제하거나 상태를 일괄 변경하지 않는다.

### Recommendations
1. 모든 경로는 `X-User-Id`·`X-Device-Id` 활성 기기를 검사하고 캐시하지 않는다.
2. `GET /api/recommendations/state`: 읽기 전용. 후보·계정 제외·서버 횟수·생성 상태·완료 기록 5개 자격 여부를 반환한다.
3. `POST /api/recommendations/generate`: `{requestId: UUID}`. **첫 생성 포함 계정당 한국 날짜 하루 3회** 성공 생성, 모든 기기·언어가 공유한다. 실패는 차감하지 않으며 조회는 무료다. 같은 요청과 동시 기기의 요청은 중복 생성·차감하지 않는다. 진행 `202`, 소진 `429`도 상태 본문을 반환한다.
4. `GET|PUT /api/recommendations/exclusions`, `DELETE /api/recommendations/exclusions/{key}`: 감상 기록과 분리한 서버 계정 선택. 종류·카탈로그 ID와 책의 ISBN·알려진 원제/저자로 판별하며 연결 기기에 반영한다. 계정 합치기·삭제에 포함한다.
5. `GET /api/recommendations/catalog?name=&type=&year=&author=`: 실제 작품/책 판본 확인. 조회 자체로 기록이나 추천 횟수를 만들지 않는다. 선택 후 기존 local-first 기록 창에서 사용자가 저장한다.
6. 새 기록은 추천에서 즉시 제외하며, 그날의 후보는 직접 저장·outbox 저장 모두 유지한다. 취향 변경은 다음 생성에 반영한다. 언어별 성공 후보를 따로 보관한다.
7. 기존 배열 `GET /api/recommendations?refresh=&excluded=`는 호환 유지하며 같은 서버 한도를 적용한다. V32 계정 상태·후보·시도·제외 테이블이 필요하다.
8. 새 추천은 6개 목표로 최대 12개 후보를 먼저 받고, 제외·중복 후 부족하면 한 번만 보충한다. 두 모델 호출도 계정 횟수는 1회다. 단계별 수량만 진단 로그에 남기며 기존 배치 조회·제외에는 자동 생성이 없다.
9. 운영 OpenAI 키는 OCI Vault의 `OPENAI_API_KEY` → 별도 `ott-openai-secrets` ExternalSecret → API 환경변수로 전달한다. 모델·추론은 Deployment의 일반 환경변수다. 배포 전 `SecretSynced`·키 존재·새 Pod 주입을 값 출력 없이 확인하고 V32 API → 동일 SHA 웹 순서로 배포한다.

### Auth
1. `POST /api/auth/register`
2. `POST /api/auth/pair`
3. `GET /api/auth/devices`
   1. 연결 기기 메타데이터는 `X-Client-Platform`의 `ios_native`·`android_native`·`windows_native`·`macos_native`(및 헤더 없는 Android 네이티브 `ottline-android/` User-Agent)를 각각 `iOS App`·`Android App`·`Windows App`·`macOS App`으로 분류한다. 등록·코드 연결과 해당 기기의 목록 조회 시 갱신하며, 기존 기기 ID·계정 연결을 보존한다. analytics 플랫폼 허용값과는 별도 계약이다. 상세는 [native-desktop-device-info.md](native-desktop-device-info.md)를 따른다.
   2. `2026-11-22` main `c693fd8`의 태블릿 표시는 같은 네이티브 플랫폼 값을 유지하면서 iPad를 `browser=iPad App`·`os=iPadOS`, Android 태블릿을 `browser=Android Tablet App`·`os=Android`로 구분한다. 명시적 기기 신호를 사용하고 빈/불명 UA로 기존 태블릿 표기를 지우지 않는다. 판별 규칙·호환성은 [태블릿 표시 변경안](changes/api-tablet-device-info-2026-11-22.md), 운영 근거는 [통합 운영 반영 기록](web-api-rollout-2026-11-22.md)을 따른다.
4. `DELETE /api/auth/devices/{id}`
5. `DELETE /api/auth/devices/all`
6. `DELETE /api/auth/account`
   1. 현재 계정의 서버 기록, 댓글, 문의, analytics 이벤트, 추천 캐시, 기기 연결을 삭제
   2. 개별 로그 삭제가 아니라 계정 단위 전체 삭제용 엔드포인트
7. `GET /api/auth/profile`
   1. 활성 기기 검증 후 현재 계정의 프로필 반환
   2. 응답: `userId`, `nickname`, `personaKey`, `profileUpdatedAt`
8. `PATCH /api/auth/profile`
   1. 활성 기기 검증 후 `nickname`, `personaKey` 저장
   2. `nickname`: trim 후 1~32자
   3. `personaKey`: `cinema_keeper`, `book_drifter`, `deep_watcher`, `midnight_logger`, `weekend_curator`, `archive_collector`
   4. 표시 이름은 서버에 저장하지 않고 프론트 번역 사전에서 관리한다
9. 활성 기기 검증
   1. `X-User-Id` + `X-Device-Id` 조합이 유효하지 않으면 `401`
   2. `logs`, `sync`, `feedback`, `analytics`, `auth/devices`, `auth/profile`, `auth/account`에 적용

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
4. `GET /internal/admin/feedback/threads?limit=`
   1. web 서버만 `X-Admin-Token`을 붙여 호출하는 cluster 내부 관리자 API다.
   2. 전체 문의 목록 반환
5. `GET /internal/admin/feedback/threads/{id}`
   1. web 서버만 `X-Admin-Token`을 붙여 호출한다.
   2. 관리자용 문의 상세 반환
6. `POST /internal/admin/feedback/threads/{id}/reply`
   1. 브라우저는 same-origin `/admin/api/feedback/**` BFF를 호출하고, BFF가 Cloudflare Access JWT와 Origin을 확인한 뒤 내부 API에 `X-Admin-Token`을 전달한다.
   2. 관리자 답변 메시지 생성 + 상태를 `ANSWERED`로 변경
7. Telegram 운영 알림
   1. 신규 문의 등록 시만 전송
   2. 설정: `TELEGRAM_NOTIFY_ENABLED`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_SERVICE_NAME`

### Analytics
1. `POST /api/nalytic/events`
   1. 브라우저/확장 프로그램이 일반 analytics 수집 API로 인식해 차단하는 것을 줄이기 위해 실제 수집 경로는 `/api/analytics/events`가 아니라 `/api/nalytic/events`를 사용한다.
   2. 익명 방문도 수집 가능
   3. 헤더: `X-Client-Id`(optional), `X-User-Id`(optional)
   4. 주요 이벤트 종류: `app_open`, `title_search`, `title_select`, `login_success`, `first_log_create`, `log_create`, `guide_cta_click`, `recommendation_open`, `recommendation_refresh`, `recommendation_dismiss`, `bookshelf_open`, `bookshelf_category_open`, `android_play_cta_impression`, `android_play_cta_click`, `android_play_cta_dismiss`, `android_reminder_card_impression`, `android_reminder_card_open`, `android_reminder_card_dismiss`
   5. 공통 properties: `hostname`, `landingPath`, `referrer`, `entrySource`, `locale`, `browserLocale`, `deviceType`, `osFamily`, `browserFamily`, `installState`, `utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent`. `entrySource`는 `android-watch-reminder`, `android-revisit-reminder`만 허용한다.
   6. 웹에서 감지한 기존 Android TWA 앱 접근은 `platform=twa`, `installState=twa`, `osFamily=android`로 집계한다. 판정 근거는 정확한 `android-app://app.ottline` referrer, 현재 URL의 `android_app_version`/`android_app_version_code`·`android_install_token`, 그 신호로 기록한 현재 session flag뿐이다. 일반 WebView·standalone PWA·과거 저장 컨텍스트 자체는 제외하고, `properties`에 `androidAppVersion`, `androidAppVersionCode`, `androidTwaSignal`을 저장한다.
   7. 네이티브 Android는 호환값 `platform=twa`와 `androidRuntime=native`를 전송한다. Windows 앱은 `platform=pwa`와 `windowsRuntime=native`를 전송한다.
   8. `analytics_events.created_at` 기준 180일이 지난 자체 분석 이벤트는 매일 자동 파기한다. 계정 전체 삭제 시 `user_id` 등 계정 식별자가 저장된 자체 이벤트만 즉시 삭제하며, 계정과 연결되지 않은 익명 이벤트는 특정 이용자를 식별해 선택 삭제할 수 없고 180일 만료로 파기한다.
2. `GET /api/nalytic/me/report`
   1. 헤더: `X-User-Id` 필요
3. `GET /internal/admin/analytics/overview?days=`
   1. top-level `/admin/analytics` 서버 화면이 `X-Admin-Token`을 붙여 server-to-server로만 호출한다.
   2. `activity.period`/`today`/`last7Days`/`last30Days`는 `rawAppOpenEvents`, `appOpenSessions`, `activeClients`, `qualifiedActors`를 포함한다.
   3. `reach`는 순차 전환율이 아닌 독립 행동 도달로 `titleSearchActors`, `titleSelectActors`, `loginActors`, `firstLogCreateActors`, `logCreateActors`를 포함한다.
   4. `daily`와 플랫폼 행도 같은 활동·도달 정의를 사용한다. 기존 `dau`/`wau`/`mau`, `activeUsers`, `funnel*` 필드는 하위 호환을 위해 한 릴리스 동안 유지하지만 새 관리자 화면과 운영 리포트에서는 사용하지 않는다.
   5. Android 앱 세그먼트 응답은 `androidAppVersions`, `androidAppVersionCodes`, `androidTwaSignals`를 포함한다.
4. `GET /internal/admin/analytics/acquisition?days=7|30|90|180`
   1. `platform`이 `web`·`pwa`·`twa`인 `app_open`의 distinct session을 유입 분모로 사용한다. 네이티브 구분에는 payload의 런타임 속성을 확인한다.
   2. 같은 session에 `title_search`, `title_select`, `login_success`, `first_log_create`, `log_create` 중 하나가 있으면 engaged session으로 집계한다.
   3. `summary`, `byChannel`, `bySource`, `byLandingPath`, `byLocale`, `byCampaign`, `daily`, `orphanConversionSessions`를 반환한다. 각 집계 행은 `sessions`, `engagedSessions`, `firstLogSessions`, `logCreateSessions`를 포함한다.
   4. attribution 우선순위는 유효한 UTM → 허용된 `entrySource` → 외부 referrer → direct/unknown이다.
5. `GET /internal/admin/analytics/events?days=&limit=&eventName=&platform=`
   1. web 서버만 `X-Admin-Token`을 붙여 호출한다.
6. `GET /internal/admin/analytics/migration-status`
   1. web 서버만 `X-Admin-Token`을 붙여 호출한다.
   2. 응답: `totalActiveUsers`, `migratedUsers`, `notMigratedUsers`, `migrationRate`, `recentMigrations`
7. `GET /internal/admin/report/daily`
   1. top-level `/admin/report` 서버 화면이 `X-Admin-Token`을 붙여 server-to-server로 호출한다.
   2. 매일 KST 기준 전일 리포트를 반환한다.
   3. 내부 지표는 admin analytics와 같은 resolved actor 기준의 `activity`·`reach`와 `dbLogCreateCount`를 사용하고, 관리자 UUID를 제외한다.
   4. Cloudflare HTTP·RUM은 KST 전일 `[00:00, 다음 날 00:00)`을 UTC `datetime_geq`/`datetime_lt`로 변환해 같은 범위를 집계한다.
   5. Cloudflare RUM은 `visits`·`방문`으로 표시하며 고유 방문자 수로 해석하지 않는다. API의 기존 `uniqueVisitors`는 순차 배포 호환을 위해 같은 값으로 유지한다.
   6. GA4 전일 값은 조회 시점 기준 잠정치다. Kubernetes는 `generatedAt` 시점의 스냅샷이며, iOS `app_store_testflight`는 실제 설치 출처를 구분하지 않는 호환 값이다.
8. `POST /internal/admin/report/daily/send`
   1. 브라우저에 토큰을 노출하지 않고 web 서버/BFF만 `X-Admin-Token`을 붙여 호출한다.
   2. 현재 데일리 리포트를 Telegram으로 수동 발송한다.

### Admin access boundary
1. 관리자 UI는 locale segment가 없는 `/admin`, `/admin/analytics`, `/admin/report`, `/admin/feedback`, `/admin/logout`만 사용한다. 기존 `/ko|en/admin/**`는 query를 버리고 top-level 경로로 리다이렉트한다.
2. Cloudflare Access self-hosted application의 기준 path를 `/admin`으로 두어 bare path와 모든 하위 경로를 보호하고, 정책은 Cloudflare 계정의 `Account Member`만 허용한다.
3. origin의 Next.js `proxy`도 `Cf-Access-Jwt-Assertion`을 team JWKS로 검증한다. RS256 서명과 issuer, audience, `exp`, `nbf`, `type=app`이 모두 유효해야 하므로 origin 직접 접근이나 위조 헤더는 거부한다.
4. 관리자 root layout에는 GA4, Clarity, PWA/service worker, 일반 사용자 동기화 런타임을 넣지 않으며 `noindex`, `no-store`를 유지한다.
5. `ADMIN_ANALYTICS_TOKEN`, `ADMIN_FEEDBACK_TOKEN`은 web/API server-to-server 경계에만 존재한다. URL, HTML, RSC payload, 브라우저 요청에는 관리자 토큰을 포함하지 않는다.

### Sync
1. `POST /api/sync/push`는 변경을 반영하고 거절된 변경을 응답으로 돌려준다.
2. `GET /api/sync/pull?since=...`는 체크포인트 이후 변경을 반환한다.
3. 로컬 우선 앱은 로컬 저장 → outbox → push/pull 순으로 반영한다. `stale` 거절 시 서버 값을 pull한 뒤 앱의 충돌 복구 흐름을 확인한다. 계약을 바꿀 때는 이전 앱의 응답 파싱, 기존 ID/판본, 중복 재시도와 기존 데이터 마이그레이션을 함께 검토한다.
4. 구현 기준은 [SyncController](../apps/api/src/main/java/com/watchlog/api/web/SyncController.java), [SyncService](../apps/api/src/main/java/com/watchlog/api/service/SyncService.java), [DB 마이그레이션](../apps/api/src/main/resources/db/migration)이다.

### ChatGPT App

현재 상태(`2026-10-10` 사용자 확인): 심사 탈락 후 서비스하지 않는다. 아래 연결 코드와 API 계약은 유지보수 대상으로 남아 있으며, 재제출 준비 범위는 [후속 채널 개편 방향](changes/v2-channel-strategy.md#chatgpt-앱)을 따른다.

1. Public MCP endpoint
   1. `GET|POST|DELETE /chatgpt/mcp`
2. Public docs and verification
   1. `GET /chatgpt`
   2. `GET /.well-known/openai-apps-challenge`
3. Protected resource / authorization metadata
   1. `GET /.well-known/oauth-protected-resource/chatgpt/mcp`
   2. `GET /.well-known/oauth-authorization-server/chatgpt/oauth`
4. OAuth endpoints (public path, web rewrite -> backend)
   1. `POST /chatgpt/oauth/register`
   2. `GET|POST /chatgpt/oauth/authorize`
   3. `POST /chatgpt/oauth/token`
5. v1 범위
   1. 읽기 전용만 지원한다.
   2. 개인 도구는 `timeline.list_recent_logs` 하나만 제공한다.
   3. 사용자는 OAuth 승인 화면에서 `Settings / Account`의 pairing code 또는 recovery code로 연결한다.
   4. 쓰기(create/update/delete)는 지원하지 않는다.

---

## 데이터 모델 핵심 합의
1. `titles`
   1. `provider`, `provider_id` 기반 upsert
   2. `unique(provider, provider_id)`
2. `users`
   1. 페어링 계정의 진실 원천
   2. `nickname`, `persona_key`, `profile_updated_at`로 무로그인 개인 프로필을 관리
   3. 성향 표시 이름과 아바타 파일 매핑은 프론트에서 관리
3. `watch_logs`
   1. 사용자의 최신 상태 레코드
   2. TPO + 시즌/에피소드 관련 필드 포함
4. `watch_log_history`
   1. create/update 시점 스냅샷 누적
   2. 상세 화면 타임라인의 진실 원천
5. `feedback_threads`
   1. 사용자별 문의 스레드
   2. `category`, `status`, `subject`, `updated_at` 관리
6. `feedback_messages`
   1. 문의 스레드 하위 메시지
   2. `author_role(USER|ADMIN)` 기준으로 작성자 구분
7. `discussion_reactions`
   1. 공개 글의 가벼운 리액션 집계
   2. `discussion_id`, `user_id`, `type(DONE|CURIOUS|SAVE)`를 관리
   3. `unique(discussion_id, user_id)`로 사용자별 공개 글당 1개 리액션만 유지
8. 미래의 타임라인 계정 상태(V32)
   1. `recommendation_account_state`: 계정별 한국 날짜 성공 횟수·2분 생성 임대
   2. `recommendation_batches`: 계정·언어별 마지막 성공 후보
   3. `recommendation_generation_attempts`: 소유/동시 참여 요청 ID의 멱등 처리, 완료·실패, 7일 보존
   4. `recommendation_exclusions`: 감상 기록과 분리한 계정별 제외 스냅샷
   5. 네 테이블 모두 계정 삭제 FK cascade. 계정 합치기는 제외를 합치고 당일 사용 횟수를 보존한다.

---
