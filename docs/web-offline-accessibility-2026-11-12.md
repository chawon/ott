# Web offline fallback and accessibility

## Scope and direction

The Modern Web Guidance audit found a reproducible offline navigation failure and accessibility gaps in title search, shared sheets, focus indicators, and page navigation. This change restores a reliable offline notice and improves those existing interactions without redesigning the recording flow.

- Repair the offline fallback so it does not depend on a locale redirect, JavaScript hydration, or network resources. Keep Korean and English notices.
- Preserve network-first HTML navigation and the existing API, admin, OG, Next.js asset, and RSC exclusions. Increase the service-worker cache version so existing installations receive the repair.
- Expose the title-search popup and active result to assistive technology while retaining pointer selection, Korean IME safeguards, and explicit record saving.
- Honor reduced motion in shared sheets, improve focus contrast using the existing brand palette, and add a localized keyboard skip link to the existing main landmark.
- Leave font subsetting and full offline record viewing/editing for separate work.

No API, database schema, IndexedDB schema, outbox, sync contract, native app, or production configuration changes are required. User records and existing local storage remain intact.

## Verification plan

1. Production build and the relevant Web package checks pass.
2. After an online visit, offline reloads of Korean and English routes show the matching offline notice with a successful service-worker response and no required network resources. An existing worker/cache can update to the repaired version.
3. Title search exposes expanded/active/selected states, arrow navigation selects the corresponding result, and Korean IME Enter does not prematurely choose a title. Pointer selection and dialog Tab/Escape/focus-return behavior remain usable on desktop and mobile.
4. Reduced-motion emulation disables sheet movement; normal motion remains available. Focus indicators meet at least 3:1 against their adjacent light and dark surfaces. The first Tab exposes the skip link and activating it focuses the main content.
5. Existing local-first record create/update/list/detail/sync regression checks continue to pass, including online/offline transitions and history consistency.

## Implementation

- `public/offline/{ko,en}.html` are standalone notices with inline styles, system fonts, localized retry links, and `noindex, nofollow`. They require no JavaScript or external assets. English-prefixed routes use the English notice; prefixless and Korean-prefixed routes use Korean, matching the routing default.
- Service worker v7 atomically precaches those documents with HTTP cache reload, avoiding redirected responses. Activation removes old application caches and retains unrelated caches. Network-first HTML and the existing bypass rules remain in place.
- Title search now exposes a combobox, listbox options, the active descendant, selected state, and debounced result/error announcements. Google Books edition links remain available outside the listbox, with distinct accessible names for same-title results. The first Escape closes suggestions, and the next closes the recording dialog.
- Shared sheets opt in to animation only when motion is allowed. Focus indicators use the existing foreground color with an orange supporting ring. A localized skip link transfers focus to the main landmark.
- `test:web-accessibility` runs against a production build in the Web CI runtime job.

## Verification results

Validated after rebasing onto `origin/main` at `434cdb0`, including the Android acquisition changes already present there:

- Next.js 16.3.8 production build and TypeScript compilation passed.
- `npm run test:client-recovery --workspace ott`: 13 passed, including offline locale selection, network-first behavior, RSC/admin bypass, and old-cache cleanup.
- `npm run test:timeline-v2 --workspace ott`: 25 passed, including offline queue retention, retry, account isolation, and synchronization ordering.
- `npm run test:web-accessibility --workspace ott`: four Korean/English, 390px/1280px scenarios passed for keyboard skip navigation, light/dark focus contrast, search arrows/IME/pointer selection, same-title edition attribution, result announcements, Escape, modal focus return, and normal/reduced motion. Two additional offline scenarios passed with the HTTP cache disabled, including v6 cache removal, unrelated-cache preservation, localized HTTP 200 fallback, reconnection, and retained IndexedDB records.
- `npm run test:book-search --workspace ott`: Google Books attribution, new and existing editions, no-ISBN titles, legacy Korean platforms, offline create/update, failed push/retry, canonical pull, and timeline checks passed.
- `test-record-save-intent.mjs`: all four mobile/desktop Korean/English recording scenarios passed.
- Scoped Biome errors: zero. `git diff --check` passed.

Browser checks used Chromium 147 with synthetic local records and intercepted API responses. Safari, physical-device screen readers, and real-user Core Web Vitals were not measured. Font subsetting and full offline record access remain outside this change.

Implementation and local verification are complete on `fix/web-offline-accessibility`, ready for PR review. Production deployment is a separate step.

## Guidance

Applied Modern Web Guidance `accessibility`, `motion`, and `performance`, with the [Google offline fallback example](https://web.dev/articles/offline-fallback-page) and [W3C combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) as supporting references.
