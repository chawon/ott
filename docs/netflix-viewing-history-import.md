# Netflix viewing history import (development)

## Scope and data meaning

The Netflix download has `Title,Date` columns. A row establishes a title and a calendar day, not completion, duration, profile, or a stable Netflix content ID. The sample inspected on 2026-09-28 has 471 rows, all valid `M/D/YY` dates, and many episode titles. Its contents are not checked into the repository.

Import rows as private **viewing events**. They do not create `watch_logs`, set `DONE`, alter a user's status/rating/note/manual `watchedAt`, publish discussions, or count as a manually created log in reports or acquisition analytics. The existing one-active-log-per-user-and-title contract remains intact.

## Flow

1. Settings links to a locale-aware Netflix import page. The browser parses the CSV and validates its header, size, dates, and row count before showing a preview. Raw files are never uploaded.
2. Exact normalized full-title matches to a user's video logs are linked. For series episode strings, a normalized series prefix may link only when the remainder contains a season or episode marker. Multiple candidate logs, different movie/series types, and all uncertain matches stay unlinked. The preview shows both counts and unresolved titles.
3. Confirming saves events to IndexedDB and a dedicated outbox item first. Sync sends a bounded batch to `POST /api/imports/netflix`, then pulls `GET /api/imports/netflix` to settle local state. Offline confirmation remains pending until sync resumes.
4. Timeline cards for existing works show their linked Netflix dates in a disclosure, without another watch-log card. A separate imported-history view shows unlinked works grouped by source title and date. Importing the same CSV again adds no duplicate events.

## Storage and API

Flyway V32 adds `netflix_viewing_events` with user ownership, nullable canonical title link, original and display titles, calendar date, optional parsed season/episode, deterministic source key, and creation time. A unique `(user_id, source, source_key)` key makes retries and repeat imports idempotent. The source key includes the raw title, date, and ordinal among identical rows, so identical same-day rows in one file remain distinct. A linked title is accepted only when the authenticated user has an active video log for it. User deletion cascades; account pairing merges events and skips duplicate source keys.

The import endpoint accepts at most 2,000 rows per request and validates all rows before writing. The list endpoint returns the user's events; each response includes whether the link is to a current active log. Imported titles are plain text until linked, avoiding false TMDB matches. Locale-specific parsing happens on the client; the API receives ISO `YYYY-MM-DD` dates.

## Verification

- The local Netflix export parsed as 471 rows with 471 distinct source keys. No personal titles or file contents were copied into the repository or test fixtures.
- Browser parser tests cover quoted CSV cells, date validation, duplicate ordinals, episode parsing, and conservative title matching.
- API unit tests cover link ownership, duplicate retries, malformed-batch rejection, and agreement with the browser's Korean-title source key. The API test suite passes.
- The mobile-width Playwright flow covers the Korean preview, manual link choice, offline save and later sync, unchanged manual note, linked timeline disclosure, separate unmatched history, repeat import, and horizontal overflow. The English import route also responded successfully.
- Docker is unavailable in this workspace, so Flyway V32 and the import query have not been exercised against PostgreSQL here. The migration must be checked in a development database before release.

Production deployment and native-app UI are outside this development-branch pass.
