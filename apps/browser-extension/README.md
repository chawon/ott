# Browser Extension MVP

Chrome extension MVP for opening `On the Timeline` with a prefilled QuickLog search from supported OTT title pages.

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
7. Confirm that `On the Timeline` opens with QuickLog prefilled

## Current behavior
- Reads the current page title from supported OTT pages
- Opens `https://ott.preview.pe.kr/ko` with query params
- Prefills QuickLog search query and platform
- Final save still happens in the web app

## Current limitations
- Video sites only
- No page-injected CTA yet
- No settings page for locale or base URL
- No automatic record creation
