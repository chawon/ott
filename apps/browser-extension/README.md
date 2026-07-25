# ottline Browser Extension

Chrome extension for opening `ottline` with a prefilled QuickLog search from
supported streaming title pages.

## Supported sites
- Netflix
- Disney+
- TVING
- wavve
- Coupang Play
- WATCHA

## How to test
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select `apps/browser-extension`
5. Open a supported OTT title page
6. Click the extension action
7. Confirm that `ottline` opens with QuickLog prefilled

## Current behavior
- Reads the current page title from supported OTT pages
- Uses Korean UI for Korean browser locales and English UI otherwise
- Opens `https://ottline.app/` for Korean or `https://ottline.app/en` for English
- Prefills QuickLog search query and platform
- Final save still happens in the web app
- Does not automatically track viewing or create logs in the background

## Validation

```bash
node --test apps/browser-extension/extension.test.mjs
node apps/browser-extension/scripts/generate-store-assets.mjs
```

Localized Chrome Web Store screenshots and promotional tiles are written to
`apps/browser-extension/store-assets`.

## Current limitations
- Video sites only
- No page-injected CTA yet
- Locale follows the browser; there is no manual locale setting
- No automatic record creation
