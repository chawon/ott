# 공개 리액션

> 함께 메뉴의 공개 글에 댓글보다 가볍게 반응하고, 필요하면 내 타임라인 기록으로 이어지는 기능

## 관련 페이지
- [[feedback]]
- [[timeline]]
- [[delete-sync]]

---

## 현황

- 구현 브랜치: `feature/public-reactions`
- 기준일: 2026-05-17
- 상태: v1 구현 중, main 미머지

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

- 낙장불입 정책 재검토는 별도 태스크로 분리한다.
- 리액션 사용자 목록 노출은 v1에서 제외한다.
- 리액션을 자동 댓글로 변환하지 않는다.
