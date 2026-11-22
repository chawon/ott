# 공개 리액션

> 함께 메뉴의 공개 글에 댓글보다 가볍게 반응하고, 필요하면 내 타임라인 기록으로 이어지는 기능

## 관련 페이지
- [[feedback]]
- [[timeline]]
- [[delete-sync]]

---

## 현황

Web의 함께 목록·상세와 공통 API에서 사용하는 기능이다. 앱별 지원 범위를 확인할 때는 [플랫폼 현황](../../../docs/platforms.md)의 출시 버전을 기준으로 한다. [웹 구현](../../../apps/web/components/DiscussionReactionChips.tsx)

`2026-11-22` Web `c693fd8`부터 큰 화면은 검색·목록과 작품·댓글·반응을 2단으로 표시하고 작은 화면은 목록→상세로 이동한다. 실제 상세 URL과 검색·선택 상태를 유지하며 첫 조회·실제 부재·재시도 가능한 오류를 구분한다. 큐레이터 질문을 제외해도 사람의 댓글·반응과 내 기록 연결은 유지한다. [변경과 운영 검증](../../../docs/web-api-rollout-2026-11-22.md)을 따른다.

## v1 범위

- 공개 글 목록/상세에 리액션 칩을 표시한다.
- 지원 리액션:
  - `DONE`: 영상은 `나도 봤어요`, 책은 `나도 읽었어요`
  - `CURIOUS`: `궁금해요`
  - `SAVE`: `저장해둘래요`
- 리액션은 댓글과 분리해서 집계한다.
- 사용자별 공개 글당 1개 리액션만 유지한다.
- 같은 리액션을 다시 누르면 취소한다.

## 내 기록 저장 규칙

- `DONE` 리액션은 내 기록에 `DONE` 상태로 저장한다.
- `CURIOUS`, `SAVE` 리액션은 내 기록에 `WISHLIST` 상태로 저장한다.
- 같은 title의 로컬 기록이 이미 있으면 상태/메모/평점/히스토리를 덮어쓰지 않는다.
- 새 기록은 프론트 local-first outbox 경로를 사용해 생성한다.

## API

- `GET /api/discussions/{id}/reactions/me`
- `PUT /api/discussions/{id}/reactions`
- `GET /api/discussions/{id}`, `latest`, `all` 응답에 `reactionSummary(done, curious, save)` 포함

## 보류

- 리액션 사용자 목록 노출은 v1에서 제외한다.
- 리액션을 자동 댓글로 변환하지 않는다.
