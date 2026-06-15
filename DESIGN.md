---
omd: 0.1
brand: ottline
bootstrapped_from: cookpad
bootstrapped_at: 2026-06-14T00:00:00+09:00
---

# Design System Inspiration of Cookpad

## 1. Visual Theme & Atmosphere

ottline is a personal recordbook for what people watch and read. Cookpad is the reference because it makes a repeated everyday act feel warm, low-pressure, and close at hand. For ottline, the interface should feel like a well-used shelf of memories rather than a blank form or productivity dashboard.

The signature surface is a warm cream canvas, not pure white. Use `#F8F6F2` as the page background, white cards as the place where posters and notes sit, and friendly orange `#FF9933` as the primary action color. Orange is a pop for record actions, focus states, and small encouragement; it is not a wash across the whole product.

The mood is homey, familiar, and unintimidating. Posters, book covers, dates, and notes are the content equivalent of Cookpad's food photography. They should carry the emotional signal. Chrome should stay quiet, corners should stay soft at `8px`, and text should stay crisp with near-black `#0F0F0F` for primary content and charcoal `#4A4A4A` for secondary UI.

**Key Characteristics:**
- Warm off-white background `#F8F6F2` — never a clinical pure white canvas
- Friendly orange `#FF9933` as the primary action and focus color
- White record tiles floating on the cream base for clear poster/card presentation
- Near-black `#0F0F0F` for readable titles and notes; charcoal `#4A4A4A` for metadata
- Soft, approachable `8px` border-radius on buttons, inputs, cards, badges, tabs, and dialogs
- Poster-forward and cover-forward: visual media is the primary content anchor
- Noto Sans-led system font stack; comfortable 16px body
- Primary button: solid orange, white text, 16px weight 600
- Warm neutral tints (`#FEF9EE`, `#ECEBE9`, `#FAF5D7`) for highlights and quiet grouping
- Warm, unpressured mood — keeping a record should feel easy to return to

## 2. Color Palette & Roles

Values below preserve the Cookpad reference and map them to ottline's recordbook surfaces.

### Brand
- **Cookpad Orange** (`#FF9933`): Primary action color for "남기기", search focus, selected controls, and important CTAs.
- **Orange on white**: primary button uses `#FF9933` background with `#FFFFFF` text.

### Surface
- **Warm Off-White / Cream** (`#F8F6F2`): Signature page background.
- **Card White** (`#FFFFFF`): QuickLog, timeline records, dialogs, and repeated cards.
- **Cream Tint** (`#FEF9EE`): Highlighted record surfaces, empty states, and gentle callouts.
- **Warm Gray Surface** (`#ECEBE9`): Dividers, disabled fills, skeleton blocks, and quiet separators.

### Text
- **Near-Black Text** (`#0F0F0F`): Primary titles, record notes, button-adjacent labels.
- **Charcoal** (`#4A4A4A`): Metadata, secondary text, icons, placeholders, helper text.
- **White** (`#FFFFFF`): Text on orange primary controls.

### Accent / Misc
- **Warm Yellow** (`#E9B83F`): Small highlights, recap emphasis, gentle badges.
- **Pale Yellow Tint** (`#FAF5D7`): Low-emphasis badges and "saved for later" style surfaces.
- **Scrim** (`rgba(0,0,0,0.2)`): Optional image overlay on poster/cover media when text must sit on top.

## 3. Typography Rules

### Font Stack
```
"Noto Sans", "Pretendard Variable", Pretendard, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif
```

Cookpad leads with Noto Sans for clean Japanese and alphanumeric rendering. ottline can keep Pretendard in the stack for Korean clarity, but the feel should remain plain, readable, and fast.

### Size Scale (observed)
| Use | Size | Weight |
|---|---|---|
| Body / record meta | `16px` | 400 |
| Record title / card title | `16px` | 600-700 |
| Primary button | `16px` | 600 |
| Category / tab label | `16px` | 400 |
| Section heading | `20-24px` | 600-700 |

### Conventions
- 16px is the comfortable body default for notes, search, and record metadata.
- Weight 600 carries buttons and record titles; 700 is reserved for stronger section headings.
- Body weight 400 keeps notes and metadata easy to scan.
- Avoid heavy display type. This product should feel like a recordbook, not a campaign page.

## 4. Component Stylings

### Buttons

**Primary**
- Background: `#FF9933`
- Text: `#FFFFFF`
- Radius: `8px`
- Padding: `8px 24px`
- Height: ~`48px`
- Font: `16px` / `600`
- Use: Main record actions — leave a log, search, save, continue writing

**Secondary / Outline**
- Background: `#FFFFFF`
- Text: `#FF9933`
- Border: `1px solid #FF9933`
- Radius: `8px`
- Use: Lower-emphasis action beside a primary

**Text / Quiet**
- Background: transparent
- Text: `#4A4A4A`
- Use: Navigation, dismiss, low-pressure actions

**Disabled**
- Background: `#ECEBE9`
- Text: `#4A4A4A`
- Use: Unavailable action

### Category Tiles

**Category Button**
- Background: transparent or `#FEF9EE`
- Text: `#0F0F0F`
- Radius: `8px`
- Padding: `16px`
- Height: ~`64px`
- Font: `16px` / `400`
- Use: Quick filters, content-type switches, timeline categories, profile choices

### Cards

**Recipe Card**
- Background: `#FFFFFF`
- Text: `#0F0F0F`
- Radius: `8px`
- Padding: `0` when media-led; `16px` when text-led
- Use: Record tile — poster or cover image first, title and metadata below, floating on `#F8F6F2`

**Promoted / Highlight Card**
- Background: `#FEF9EE`
- Radius: `8px`
- Use: Empty states, recap prompts, recovery-card surfaces, and gentle account callouts

### Inputs

**Search Field**
- Background: `#FFFFFF`
- Text: `#4A4A4A` placeholder, `#0F0F0F` typed
- Radius: `8px`
- Padding: `12px 16px`
- Focus: border/ring in `#FF9933`
- Use: Title search as the front door of the product

### Badges

**Rating / Highlight Badge**
- Background: `#FAF5D7` or `#E9B83F`
- Text: `#4A4A4A` or `#0F0F0F`
- Radius: `8px` or `full`
- Use: Status, place, occasion, source labels, recap highlights

## 5. Layout Principles

### Density
ottline is medium density and media-forward. The grid or list can be efficient, but each record should leave enough room for the poster, title, date, and note to feel remembered rather than filed. The cream base separates white cards without relying on heavy borders or shadows.

### Spacing & Structure
- Title search and QuickLog are the core loop; make them prominent and easy to return to.
- Category tiles and tabs should be large enough to tap without precision.
- Timeline cards float on the cream base with minimal depth.
- Dialogs should feel like a clear white sheet on a warm page, not a heavy modal system.

## 6. Depth & Elevation

ottline should read soft and mostly flat. Depth comes from the warm cream background separating white cards, plus poster and cover art.

- Record cards: minimal shadow; cream-vs-white contrast and `8px` radius do most of the work
- Media tiles: optional subtle scrim when text sits over artwork
- Dropdowns / dialogs: light shadow + scrim
- Avoid glossy, dramatic, or dashboard-heavy elevation

## 7. Do's and Don'ts

- **DO** put the interface on warm cream `#F8F6F2`. **DON'T** use a pure-white clinical canvas.
- **DO** reserve orange `#FF9933` for primary actions and focus. **DON'T** flood the product with orange.
- **DO** let posters, covers, dates, and notes dominate record cards. **DON'T** clutter cards with chrome.
- **DO** use `8px` radius consistently. **DON'T** use sharp corners or oversized pill cards.
- **DO** use near-black `#0F0F0F` for primary text. **DON'T** make record titles low contrast.
- **DO** keep copy warm, plain, and encouraging. **DON'T** make logging feel like submitting a form.
- **DO** keep mobile controls generous. **DON'T** shrink navigation into tiny rows.
- **DO** use Noto Sans / Pretendard / system fallback. **DON'T** load a heavy decorative font.

## 8. Responsive Behavior

| Width | Behavior |
|---|---|
| Desktop | Wide content column on cream base; top nav and QuickLog prominent |
| Tablet | Cards and panels reflow to fewer columns; tabs wrap cleanly |
| Mobile | Single-column record flow; floating bottom nav; title search and record action easy to reach |

### Touch & Mobile
- Category tiles and primary buttons should meet or exceed 48px touch height.
- Record cards should preserve readable titles at 16px.
- Floating bottom navigation is part of the mobile core loop and must not disappear behind browser chrome.
- The product is often opened briefly after watching or reading; make the first action obvious.

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary / action: Cookpad Orange `#FF9933`
- Page bg: warm cream `#F8F6F2`; card bg `#FFFFFF`
- Text: `#0F0F0F`; chrome/secondary `#4A4A4A`
- Warm accents: `#E9B83F`, `#FEF9EE`, `#FAF5D7`
- Radius: `8px` everywhere

### Example Component Prompts
- "Create an ottline primary button in Cookpad style: solid `#FF9933`, white text, `8px` radius, `8px 24px` padding, height about 48px, 16px weight 600."
- "Build an ottline record card: white bg, `8px` radius, poster or cover media first, title below at 16px weight 600 `#0F0F0F`, metadata in `#4A4A4A`, floating on `#F8F6F2`."
- "Design a Cookpad-style category grid for ottline: large tappable tiles around 64px tall, `8px` radius, 16px padding, icon + label at 16px `#0F0F0F`."
- "Create an ottline title search bar: white field, `8px` radius, `#4A4A4A` placeholder, focus ring in `#FF9933`, placed on a `#F8F6F2` page."

### Iteration Guide
1. Warm cream `#F8F6F2` background, never pure white.
2. Orange `#FF9933` is a pop, not a wash.
3. Posters and covers are the content anchor.
4. `8px` radius everywhere.
5. Text `#0F0F0F` on cream/white for crisp readability.
6. 16px body, weight 600 for buttons and titles.
7. Large tappable navigation.
8. Noto Sans / Pretendard / system fallback.

## 10. Voice & Tone

ottline's voice is warm, encouraging, and refreshingly unpretentious. It speaks to someone who just watched, read, remembered, or wants to come back later. The copy should make keeping a record feel light and useful, not official. Korean copy should be plain and friendly; English copy should be short and personal.

| Context | Tone |
|---|---|
| Buttons | Short friendly verb — `남기기`, `저장`, `이어 적기`. Inviting, no pressure. |
| Record meta | Plain and helpful — date, place, platform, status. Practical, never fussy. |
| Empty states | Encouraging — invite the user to search or leave the first record. |
| Community | Warm and nearby — other people's records are traces, not a noisy feed. |
| Errors | Gentle and blameless; one calm sentence plus the fix. |
| Success | Friendly confirmation with a sense of the record being kept. |
| Onboarding | Welcoming, low-pressure — logging should feel easy to start. |

**Forbidden patterns.** Submission language, productivity workflow jargon, elite cinephile or critic tone, pressure/FOMO copy, shouting CTAs, and anything that makes a casual viewer or reader feel they did it wrong.

**Voice samples.**
- `기록 남기기` — primary record action.
- `오늘 남길 작품을 찾아볼게요` — search prompt.
- `타임라인에 쌓였어요` — success-style confirmation.

## 11. Brand Narrative

<!-- omd:limitation Project founding date was not provided. Replace before shipping if a public brand-history section is required. -->

ottline is a personal media recordbook for video and books. [FILL IN: founding timing if this design system is used in external brand documentation.] The product direction is clear: recommendation is not the core promise; remembering, revisiting, sharing, and continuing a record are. It works without turning the user into an account workflow first, and it treats the timeline as the value that grows over time.

The design language flows from that product thesis. **One**, it should feel warm and unintimidating, because the user is often recording a small memory after a show, a film, a series episode, or a book. **Two**, media must stay visible, because posters, covers, and titles carry the emotional recall. **Three**, it is personal before it is social; public records and comments should feel like nearby traces from other people, not a competitive feed.

What ottline refuses: cold data-entry screens, recommendation-feed gloss, and productivity-dashboard pressure. It chooses warmth, speed, and memory every time — software that makes it easy to leave a note and come back later.

## 12. Principles

1. **Make everyday recording easy.** The first action should feel like keeping a note, not completing a task. *UI implication:* Warm surfaces, friendly verbs, and one clear primary action.

2. **Media is the memory anchor.** Posters and covers help people remember what they watched or read. *UI implication:* Cards stay media-forward; chrome stays quiet; metadata supports recall without taking over.

3. **Never make the user feel behind.** The product is for casual recording, not performance. *UI implication:* Plain copy, blameless errors, low-pressure CTAs, and no streak-pressure patterns.

4. **Personal first, community nearby.** Shared records can add life without becoming a feed. *UI implication:* Keep public traces compact, warm, and non-competitive.

5. **Warm, not clinical.** The interface should feel like a familiar recordbook. *UI implication:* Cream background, orange primary action, warm neutrals, soft `8px` corners, gentle depth.

## 13. Personas

*Personas are fictional archetypes informed by ottline's product shape, not real individuals.*

**민지, 34, Seoul.** Watches series after work and wants to remember where she stopped, what she felt, and whether it is worth continuing. Opens ottline briefly on mobile. Needs fast search, a clear record action, and a timeline that feels personal.

**Daniel, 29, New York.** Tracks films, shows, and books across services. Cares less about recommendations and more about having one place where his watched and read history accumulates. Values export, search, and clean metadata.

**서현, 41, Busan.** Reads and watches with family. Uses notes, place, occasion, and shared cards to remember context. Needs the UI to feel friendly and reliable rather than like a social app.

## 14. States

| State | Treatment |
|---|---|
| **Empty (no search results)** | Warm cream canvas, one encouraging line suggesting a broader search or another title, plus the search field. |
| **Empty (no saved records)** | Friendly one-liner inviting the user to leave the first record; orange primary to start. |
| **Loading (record grid)** | Skeleton cards in warm-gray `#ECEBE9` at final card dimensions; no layout shift. |
| **Loading (inline)** | In-button spinner; button keeps `8px` radius and orange fill; label swaps to loading. |
| **Error (field)** | Orange-tinted border or helper line; cause plus fix in one calm sentence. |
| **Error (page/network)** | Soft notice on cream; one sentence plus retry. |
| **Success (record saved)** | Warm confirmation that the item was kept in the timeline. |
| **Disabled** | Warm-gray `#ECEBE9` fill, muted text. |
| **Skeleton** | Warm-gray blocks at exact final size; respect reduced motion. |
| **Empty (new profile)** | Gentle invitation to add a nickname or keep recording first; no pressure. |

## 15. Motion & Easing

ottline's motion is gentle and warm. It should clarify state changes and make saving feel responsive without turning the interface into a playful animation system.

**Durations:**

| Token | Value | Use |
|---|---|---|
| `motion-instant` | 0ms | Toggle commits, selection |
| `motion-fast` | 150ms | Button hover/press, nav tap |
| `motion-standard` | 250ms | Card reveal, dropdown, media fade-in |
| `motion-modal` | 300ms | Modal/dialog enter-exit |

**Easings:**

| Token | Curve | Use |
|---|---|---|
| `ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | The default |
| `ease-enter` | `cubic-bezier(0, 0, 0.2, 1)` | Things arriving |
| `ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Dismissals |
| `ease-warm` | `cubic-bezier(0.34, 1.2, 0.64, 1)` | Reserved for a saved-record micro-moment |

**Spring stance.** A single soft overshoot is permitted on a save or record-created moment. Everywhere else, motion stays calm and standard.

**Signature motions.**
1. **Media fade-in.** Posters and covers fade in `opacity 0->1` over `motion-standard / ease-standard`.
2. **Save-record moment.** The save/check icon scales `1.0 -> 1.12 -> 1.0` over `motion-standard / ease-warm` and fills orange.
3. **Category tile press.** Subtle background tint over `motion-fast / ease-standard`.
4. **Modal enter.** Scrim fades in; dialog appears with opacity + slight translate over `motion-modal / ease-enter`.

**Reduce motion.** Under `prefers-reduced-motion: reduce`, all `motion-*` collapse to `motion-instant`; overshoot becomes a simple color/fill change.

<!--
OmD v0.1 Sources — Cookpad

Reference source:
- https://oh-my-design.kr/design-systems/cookpad.md

Builder config:
- https://oh-my-design.kr/builder?step=preview&ref=cookpad&cfg=Y29va3BhZHx8fHx8MHxidXR0b24saW5wdXQsdGFibGUsY2FyZCxiYWRnZSx0YWJzLGRpYWxvZw

Requested components:
- button, input, table, card, badge, tabs, dialog

Verified reference tokens:
- #FF9933 primary, #F8F6F2 cream bg, #FFFFFF card, #0F0F0F text, #4A4A4A chrome,
  #FEF9EE cream tint, #ECEBE9 warm gray, #FAF5D7 pale yellow, 8px radius.
-->
