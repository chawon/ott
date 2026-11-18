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

## Production deployment

- PR [#130](https://github.com/chawon/ott/pull/130) merged as application SHA `4cabcd553a952bc27db9b39b02ad94498e225cec`. Its source tree matches the verified PR head `8b1cd7f`.
- PR Web CI [43139662667](https://github.com/chawon/ott/actions/runs/43139662667), main Web CI [43158268458](https://github.com/chawon/ott/actions/runs/43158268458), and Web production [43158345911](https://github.com/chawon/ott/actions/runs/43158345911) succeeded.
- Production manifest commit: `753ef492dd922c13089824c3b12b675bdf9f6bae`. After refreshing ArgoCD, `ott-app` reached `Synced Healthy`, the Web image used the application SHA, and `APP_VERSION=4cabcd5`. Web and API Pods were ready with zero restarts.
- The public version endpoint returned HTTP 200 and `4cabcd5`. Public `/sw.js` and both offline documents returned HTTP 200 and matched the reviewed source hashes. Korean and English page HTML included the skip link and focusable main landmark.
- A fresh Chromium 147 context on `https://ottline.app` installed worker v7, removed a seeded v6 cache, and retained an unrelated cache. Injecting network transport failure only in that isolated worker returned the real cached Korean and English notices for `/timeline` and `/en/timeline`, both HTTP 200 from the service worker, with no external scripts/styles/images required. Restoring transport returned to an online document successfully. API and write requests were blocked throughout the probe.
- The browser probe used explicit worker transport failure because page-level offline emulation can leave the worker's network target available. The application handler, cached responses, and production server were not modified by this probe. Cloudflare's optional metrics request on online static-page navigation was blocked.
- IndexNow accepted 19 URLs with HTTP 200. The API retained image `916be7abe9a8712d3f5a0a5e460a7bf820e23b0c`; native binaries and user records were unchanged by the rollout.

## Verification follow-up

The offline browser check now waits on the synchronous condition `navigator.serviceWorker.controller?.state === "activated"`. This prevents an asynchronous registration lookup from letting cache assertions run before activation finishes. The follow-up changes the verification script and documentation; the deployed application remains `4cabcd5`.

## Guidance

Applied Modern Web Guidance `accessibility`, `motion`, and `performance`, with the [Google offline fallback example](https://web.dev/articles/offline-fallback-page) and [W3C combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) as supporting references.
