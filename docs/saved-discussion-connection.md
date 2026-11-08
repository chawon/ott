# 기록 뒤 같은 작품의 공개 이야기 연결

## 범위와 방향

기록 저장 완료 뒤, 같은 작품에 다른 사람이 남긴 공개 댓글·공유 메모가 실제로 있으면 기존 ‘함께’ 이야기로 이어지는 작은 안내를 보여준다. 기록 자체는 이미 끝난 상태이며, 안내를 읽거나 눌러도 내 기록을 자동으로 공개하지 않는다. 기존 완료·메모 더하기·공유 카드 동선은 유지한다. 본문 미리보기는 보여주지 않아 보는 중·보고 싶은 작품의 내용을 먼저 드러내지 않는다.

저장 완료의 작은 `SavedDiscussionLink` 컴포넌트가 부가 조회를 담당한다. local-first 저장 및 동기화를 기다리게 하지 않으며 `resolveLogLocal`로 확인한 동기화 완료 작품의 정식 ID만 조회한다. 임시 ID 교체·`sync:updated`·기기/계정 변경·오프라인 전환·작품 변경·기록창 닫기에서 이전 결과와 늦은 응답을 무효화한다. 영화/시리즈 종류와 외부 식별자, 책의 동일 ISBN 판본을 확인하며 작품명으로 연결하지 않는다.

## 읽기 전용 API

`GET /api/discussions/connection?titleId={정식 작품 UUID}`

- 기존 활성 기기의 `X-User-Id`·`X-Device-Id`를 확인한다. 조회를 위해 신규 계정을 등록하거나 인증 정보를 만들지 않는다.
- 해당 작품에 실제 내용이 있는 다른 사용자의 공개 댓글이 하나라도 있으면 `{discussionId, titleId}`를, 없으면 `null`을 반환한다. 예전 익명 댓글(`userId=null`)도 공개 이야기로 인정한다.
- 빈 이야기, 내 댓글만 있는 이야기, 공백뿐인 댓글, 삭제된 작품에는 안내하지 않는다. 실제 댓글을 검사하므로 오래된 누적 `commentSeq`나 댓글 목록의 200개 제한에 의존하지 않는다.
- 응답은 `Cache-Control: private, no-store`이며 본문·사용자 정보·감상 날짜·장소·상황을 담지 않는다.
- 기존 API 응답·기록/댓글 스키마·공개 범위·리액션 동작은 바꾸지 않는다. 조회 실패와 오프라인은 조용히 안내를 생략하며 기록 저장 결과와 오류 표시에는 영향을 주지 않는다.

## 검증 시나리오

1. 실제 PostgreSQL의 격리 임시 스키마에서 빈 이야기·내 댓글만 있는 이야기·다른 사람의 댓글·이전 익명 댓글·공백·삭제·정확한 작품/판본 구분과 첫 200개 이후의 다른 댓글을 확인한다. 조회 전후 데이터가 변하지 않는지도 확인한다.
2. 컨트롤러는 기존 기기 검증·인증 실패 시 조회 금지·캐시 금지·본문 없는 응답을 확인한다.
3. 격리 브라우저에서 PC·모바일, 한국어·영어의 저장 완료·기존 이야기 읽기·대화창 닫기·완료 버튼을 확인한다.
4. 기존 이야기 없음·내 댓글만 있음·조회 오류·오프라인·동기화 후 정식 ID 교체·늦은 응답·계정 변경·서로 다른 작품/종류/책 판본을 검사한다. 읽기 연결 과정에서 공개 글·댓글을 작성하지 않는지 확인한다.

별도 폴더에서 빌드 후 WSL 3000과 기존 고정 ngrok 개발 미리보기에 반영한다. 실제 운영 SEO·운영 배포·사용자 데이터 변경은 이번 범위에 없다.

## 검증 결과

- `OTTLINE_DISCUSSION_DB_TEST=1 ./gradlew test --tests '*DiscussionConnection*Test' --no-daemon --max-workers=2`: 11개 통과, 실패·건너뜀 0. 실제 PostgreSQL/JPA 조회 5개와 서비스·컨트롤러 6개를 포함한다. 임시 스키마는 검사 종료 후 삭제했다.
- `scripts/test-saved-discussion-connection.mjs`: 격리된 API·실제 IndexedDB로 14개 시나리오 통과. 저장 완료에서 기존 이야기로 직접 이동하고 기록창이 닫히는 흐름, 빈 결과·401·403·503에서도 기록과 기기 연결 보존, 오프라인 저장 후 연결, 정식 ID 교체 대기, 닫은 뒤 늦은 응답, 계정 변경, 종류·판본 불일치, sync 재조회와 잘못된 목적지를 검사했다. 공개 글·댓글·신규 인증 쓰기는 모두 0건이다.
- PC 1440px 한국어와 모바일 390×844px 영어에서 안내 링크와 완료 버튼이 추가 스크롤 없이 보인다. 모바일에 실제 크기의 인라인 포스터를 추가한 재검사도 통과했다. 해당 포스터의 완료 버튼 아래쪽은 769.7px, 보이는 본문 아래쪽은 843px이다.
- 분리한 Next.js 빌드와 TypeScript 검사 통과. 변경 TS/JSON/브라우저 검사 lint는 오류 0이며 QuickLogCard의 기존 경고 2개는 유지한다. 기본 루트 `npm run test`는 등록되어 있지 않아 위의 관련 검사를 사용했다.

브라우저 검사는 `WEB_RUNTIME_URL`, `PLAYWRIGHT_EXECUTABLE_PATH`, 선택적으로 `SAVED_DISCUSSION_QA_CASE`와 `SAVED_DISCUSSION_QA_POSTER=1`을 받아 실행할 수 있다. 기본 접속은 loopback으로 제한하며 현재 WSL 주소 `172.24.75.199`에서 검사할 때만 `SAVED_DISCUSSION_QA_ALLOW_PREVIEW=1`을 명시한다. API 격리·공개 쓰기 금지 검사는 접속 주소와 관계없이 유지한다. 실행 근거는 Git에서 제외된 `.recovery/ottline-v2/saved-discussion-browser`와 `saved-discussion-browser-poster`에 보관했다. 개발 미리보기의 최종 반영과 외부 URL 확인은 검증된 빌드 활성화 단계에서 수행한다.

## 개발 미리보기 반영

검증한 빌드를 기존 WSL 3000에 반영했다. 실제 WSL 주소에서 한국어 PC와 포스터 포함 영어 모바일의 저장 → 기존 이야기 읽기 → 기록창 닫기 동선을 다시 통과했다. 모든 API 응답을 격리했으며 실제 계정이나 공개 글에는 쓰지 않았다. 기존 `canonical-title`, `offline-new-record` 공유 검사도 통과했다. 개발 API·WSL 홈·고정 ngrok 홈은 HTTP 200이고 세 서비스 모두 실행 중이며 임시 3218 검증 서버는 종료했다. 운영 API·웹 배포는 수행하지 않았다.

반영 후 브라우저 근거는 `.recovery/ottline-v2/saved-discussion-live-wsl-pc`와 `saved-discussion-live-wsl-mobile`에, 이전 웹 빌드는 `.recovery/ottline-v2/snapshots/next-before-saved-discussion-20261108T064304Z`에 보관한다.
