# ChatGPT Directory Screenshots Plan

## Goal

- Create submission-ready screenshots for the ottline ChatGPT app directory.
- Match the current app scope: widget-based, read-only, `timeline.list_recent_logs` only.
- Keep the assets reproducible from code instead of relying on one-off manual edits.
- Use browser-rendered capture of the real widget template rather than a custom mock layout.

## Scope

- Type: asset generation only
- Impacted areas:
  - Docs
  - Browser capture script
  - Generated PNG outputs under `apps/web/public/chatgpt-directory/`
- Out of scope:
  - Runtime product behavior
  - MCP/OAuth/API changes
  - Submission copy fields

## Submission Constraints

- Use widget screenshots, not prompt or response screenshots.
- Do not show browser chrome, user prompts, model responses, or explanatory overlays.
- Avoid heavy embedded text because the first screenshots are reused across locales.
- Export PNGs at the directory frame size of `706x860`.
- Also export `@2x` variants from the same source because the submission flow asks for at least one retina-quality image.

## Visual Direction

- Show the actual ottline widget UI only.
- Do not imitate the surrounding ChatGPT host shell.
- Use minimal UI labels and short sample metadata only where needed to make the widget look alive.
- Use generic sample titles and abstract poster art to avoid copyrighted marketing art and locale-specific copy.
- Reuse the real widget template directly.
- Provide three public states:
  - `recent`: mixed recent history
  - `movies`: recent movie-only filter
  - `series`: recent series-only filter

## Output Paths

- `apps/web/public/chatgpt-directory/screenshot-recent-706x860.png`
- `apps/web/public/chatgpt-directory/screenshot-movies-706x860.png`
- `apps/web/public/chatgpt-directory/screenshot-series-706x860.png`
- `apps/web/public/chatgpt-directory/screenshot-recent-1412x1720@2x.png`
- `apps/web/public/chatgpt-directory/screenshot-movies-1412x1720@2x.png`
- `apps/web/public/chatgpt-directory/screenshot-series-1412x1720@2x.png`

## Generation Flow

1. Inject mock config and a mock MCP bridge into `apps/web/public/chatgpt-widget-v2.html`.
2. Render in Playwright Chromium at `706x860` with `deviceScaleFactor=2`.
3. Trigger the real widget buttons for `recent`, `movies`, and `series`.
4. Save the native retina PNG first.
5. Downscale the retina capture to the base export with `sharp`.

## Validation

1. Files are generated as PNG.
2. Base exports are exactly `706x860`.
3. `@2x` exports are generated from the same layout without composition drift.
4. No screenshot contains a typed user message or model answer.
5. The widget state is visually identifiable in all three screenshots.
6. Screenshots come from the real widget template, not a separate mock layout.
