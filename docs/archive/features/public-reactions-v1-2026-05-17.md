# Public Reactions v1

Date: 2026-05-17

## Goal

Let users react lightly to public discussion items without writing a full comment, and optionally turn that action into a personal timeline record.

## Scope

- Add reaction chips to public discussion list/detail surfaces.
- Supported reaction types:
  - `DONE`: `나도 봤어요` for video, `나도 읽었어요` for books
  - `CURIOUS`: `궁금해요`
  - `SAVE`: `저장해둘래요`
- Store reaction counts separately from comments.
- Keep comments as written text only.
- On reaction click, create a local-first personal record if the title is not already in the user's local timeline.

## Out of Scope

- Reconsidering the no individual delete policy.
- Showing a list of users who reacted.
- Turning reactions into comments.
- Publicly exposing user profile names/avatars on reactions.

## API Design

- `GET /api/discussions/{id}` includes `reactionSummary`.
- `GET /api/discussions/latest` and `GET /api/discussions/all` include `reactionSummary`.
- `GET /api/discussions/{id}/reactions/me` returns the current user's selected reaction types.
- `PUT /api/discussions/{id}/reactions` toggles one reaction for the active user.

The reaction API requires `X-User-Id` and `X-Device-Id`, matching comment creation and other authenticated paths.

## Local Record Behavior

- `DONE` creates a `DONE` log.
- `CURIOUS` and `SAVE` create a `WISHLIST` log.
- If the same title already exists locally, the action does not overwrite status, note, rating, or history.
- The created record uses the existing outbox sync path and `origin: "LOG"`.

## Verification

- API build and focused frontend checks.
- Public list and detail compile with reaction summary.
- Reaction click calls authenticated API and creates at most one local record per title.
