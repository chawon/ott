# SEO keyword audit: OTT record queries

Date: 2026-06-04

## Target queries

- `ott 기록`
- `ott 시청 기록`

## Current finding

- Google-index style web search shows `ottline.app` is indexed, but generic target queries do not surface ottline prominently.
- Naver generic search result HTML for both target queries did not include `ottline` or `ottline.app` on the checked first result page.
- Naver `site:ottline.app ott 기록` shows `https://ottline.app/about`, so Naver has at least some index coverage for the site.
- Live `robots.txt` allows crawling and points to `https://ottline.app/sitemap.xml`.
- Live `sitemap.xml` is valid, but home/about/faq `lastmod` values still point to 2026-03-16.

## Low-risk changes

- Add exact Korean intent phrases such as `OTT 기록` and `OTT 시청 기록` to the home metadata, about page copy, and global footer copy.
- Keep copy natural and avoid keyword stuffing.
- Refresh the sitemap content date for changed evergreen pages.
