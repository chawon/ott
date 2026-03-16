# GEO Audit Report: ottline

**Audit Date:** 2026-03-16
**URL:** https://ottline.app
**Business Type:** Consumer SaaS / PWA (Korean-language media tracking web app)
**Pages Analyzed:** 7 (home, timeline, public, account, about, faq, privacy)

---

## Executive Summary

**Overall GEO Score: 30/100 — Critical**

ottline has a technically sound foundation — HTTPS, clean robots.txt, valid sitemap, Next.js RSC framework, and all AI crawlers permitted — but almost no signal layer exists for AI systems to discover, understand, or cite it. The three most severe problems are: (1) five of seven pages are client-side rendered, making their content invisible to AI crawlers that don't execute JavaScript; (2) there is zero Schema.org structured data anywhere on the site; and (3) the brand has no verifiable third-party presence that AI models use for entity recognition. These are all fixable, and the highest-impact fixes (converting FAQ/Privacy to RSC, adding FAQPage + Organization JSON-LD, creating llms.txt) can be implemented in a single day.

### Score Breakdown

| Category | Score | Weight | Weighted Score |
|---|---|---|---|
| AI Citability | 42/100 | 25% | 10.5 |
| Brand Authority | 5/100 | 20% | 1.0 |
| Content E-E-A-T | 38/100 | 20% | 7.6 |
| Technical GEO | 51/100 | 15% | 7.65 |
| Schema & Structured Data | 4/100 | 10% | 0.4 |
| Platform Optimization | 24/100 | 10% | 2.4 |
| **Overall GEO Score** | | | **30/100** |

---

## Critical Issues (Fix Immediately)

### C1 — FAQ, Privacy, and Home pages are client-side rendered (invisible to AI crawlers)

Five of seven pages use `"use client"` components with `useTranslations` from `next-intl`. AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do not execute JavaScript. When these crawlers fetch `/faq`, `/privacy`, `/timeline`, `/public`, and the homepage, they see only the layout shell — navigation, footer, and `<head>` metadata. **All FAQ answers, all privacy policy text, and all homepage content is invisible.**

The `about/page.tsx` is already a correct RSC using `getTranslations` from `next-intl/server` — it serves as the template. The FAQ and Privacy pages have no technical reason to be client components; converting them takes under an hour each.

**Affected pages:** `/faq`, `/privacy`, `/` (homepage), `/timeline`, `/public`
**Fix:** Remove `"use client"`. Replace `useTranslations` with `getTranslations` (server import from `next-intl/server`). See `about/page.tsx` as the reference implementation.

---

### C2 — Zero Schema.org structured data on any page

There is no JSON-LD, Microdata, or RDFa schema markup anywhere across all seven pages. Open Graph and Twitter Card tags exist, but these are social sharing protocols — they are invisible to schema parsers and AI knowledge graphs. The site is a web application with an FAQ page and a structured About page, making it a strong candidate for at minimum three schemas: `Organization`, `SoftwareApplication`, and `FAQPage`.

**Fix:** Add these three JSON-LD blocks server-rendered in the initial HTML (not client-side injected):

**1. Organization schema — add to homepage `<head>`**
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "ottline",
  "url": "https://ottline.app",
  "logo": {
    "@type": "ImageObject",
    "url": "https://ottline.app/og-image.png",
    "width": 1200,
    "height": 630
  },
  "description": "가입 없이 영상·책 기록을 10초 만에 남기고 타임라인으로 모아보세요. 영상과 책을 가장 빠르게 기록하는 방법.",
  "inLanguage": "ko-KR",
  "sameAs": []
}
```

**2. SoftwareApplication schema — add to homepage `<head>`**
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "ottline",
  "url": "https://ottline.app",
  "description": "가입 없이 영상·책 기록을 10초 만에 남기고 타임라인으로 모아보세요.",
  "inLanguage": "ko-KR",
  "applicationCategory": "LifestyleApplication",
  "applicationSubCategory": "Entertainment",
  "operatingSystem": "Web, Android (PWA), iOS (PWA)",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "KRW" },
  "isAccessibleForFree": true,
  "featureList": [
    "로그인 없는 영상·책 기록",
    "로컬 퍼스트 데이터 저장 (IndexedDB)",
    "타임라인 뷰",
    "페어링 코드로 기기 간 동기화",
    "CSV 내보내기",
    "PWA 설치 지원"
  ]
}
```

**3. FAQPage schema — add to `/faq` `<head>`**
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "name": "자주 묻는 질문",
  "url": "https://ottline.app/faq",
  "inLanguage": "ko-KR",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "로그인 없이 어떻게 데이터가 유지되나요?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "ottline은 로컬 퍼스트(Local-first) 기술을 사용합니다. 사용자가 입력한 모든 기록은 먼저 브라우저 내부 저장소(IndexedDB)에 저장됩니다."
      }
    },
    {
      "@type": "Question",
      "name": "기기를 변경해도 기록을 볼 수 있나요?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "계정 메뉴에서 발급받은 페어링 코드를 새 기기에 입력하면 기록을 그대로 이어서 볼 수 있어요."
      }
    },
    {
      "@type": "Question",
      "name": "페어링을 하면 기록은 어떻게 합쳐지나요?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "같은 작품에 대한 기록이 양쪽에 모두 있으면, 더 최근에 수정된 내용이 남아요."
      }
    },
    {
      "@type": "Question",
      "name": "기록을 삭제하고 싶으면 어떻게 하나요?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "설정 > 로컬 초기화에서 한 번에 지울 수 있어요. 현재 기기에 저장된 데이터만 삭제합니다."
      }
    },
    {
      "@type": "Question",
      "name": "내 기록을 파일로 내려받을 수 있나요?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "설정 > 내 기록 내보내기에서 CSV 파일로 내려받아 엑셀이나 스프레드시트로 정리할 수 있어요."
      }
    },
    {
      "@type": "Question",
      "name": "서비스 이용료가 있나요?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "ottline은 모든 기능을 무료로 제공합니다."
      }
    }
  ]
}
```

**Note:** In Next.js App Router, render these as `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />` inside a server component. Do NOT inject via `useEffect` or a client component — AI crawlers will not execute the JavaScript.

---

### C3 — No llms.txt file

`https://ottline.app/llms.txt` returns a 404 (the Next.js app shell). This emerging standard is actively honored by Perplexity, ChatGPT, Claude, and Gemini crawlers to understand site structure and content priorities. For a 7-page app, creating this file takes 30 minutes.

**Fix:** Create `public/llms.txt` with the following content:

```
# ottline

> 로그인 없이 영상과 책을 기록하는 무료 타임라인 서비스.
> A free, login-free video and book logging timeline. Data is stored locally in the browser using IndexedDB. No account required.

## Core Pages

- [Home](https://ottline.app): Start logging videos and books instantly without creating an account.
- [About](https://ottline.app/about): How ottline works — three-step workflow and key features.
- [FAQ](https://ottline.app/faq): Data persistence, cross-device pairing, CSV export, and pricing answers.
- [Privacy Policy](https://ottline.app/privacy): Data handling and local-first storage policy.

## Optional

- [Timeline](https://ottline.app/timeline): Personal viewing and reading timeline view.
- [Public](https://ottline.app/public): Publicly shared records from all users.
```

---

## High Priority Issues (Fix Within 1 Week)

### H1 — No canonical tags; sitemap URL mismatch with `/[locale]/` routing

No `<link rel="canonical">` tag exists on any page. The app routes via `[locale]` prefix (content served at `/ko/about`, `/ko/faq`), but the sitemap lists root paths (`/about`, `/faq`). AI crawlers following the sitemap may index different URLs than the canonical ones, creating duplicate content signals.

**Fix:** Add `alternates.canonical` to each page's `generateMetadata`. Align sitemap URLs with actual production URL form. Add `hreflang` alternate tags for `ko` and `en`.

### H2 — All pages share identical meta description and og:url/og:title

The layout-level `generateMetadata` sets the same description, og:url (`https://ottline.app`), and og:title (`ottline`) on every page. AI summarizers and social crawlers cannot differentiate pages.

**Fix:** Override `title`, `description`, `openGraph.url`, and `openGraph.title` in each page's `generateMetadata`. Example for `/faq`: title `"자주 묻는 질문 | ottline"`, description `"ottline 데이터 저장 방식, 기기 변경, CSV 내보내기, 요금 안내"`.

### H3 — No security headers in next.config.ts

No `headers()` configuration exists. `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Content-Security-Policy` are all absent at the application layer.

**Fix:** Add a `headers()` async function to `next.config.ts`:
```js
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ],
  }];
}
```

### H4 — Brand has no third-party presence (Brand Score: 5/100)

No Wikipedia article, no Namu.wiki entry, no YouTube channel, no GitHub organization, no LinkedIn company page, no Product Hunt listing, no Reddit mentions. AI models build entity graphs from third-party corroboration — without it, they cannot confidently cite or recommend ottline.

**Fix (priority order):**
1. Create a Namu.wiki article (Korean-language Wikipedia equivalent, heavily indexed by Korean AI models)
2. List on alternativeto.net under "Media Tracker" and "Book Tracker" categories
3. Launch on Product Hunt (creates indexed English-language entity reference)
4. Create a YouTube channel and upload one screen-recording demo

### H5 — No contact information visible anywhere

No email, support form, or social media handle appears on any page. For a local-first app where data loss is a realistic scenario (browser cache clearing), this is a critical trust gap.

**Fix:** Add a support email or feedback link to the About and FAQ pages.

---

## Medium Priority Issues (Fix Within 1 Month)

### M1 — Sitemap `lastmod` always reports today's date

`sitemap.ts` uses `lastModified: new Date()`, so every sitemap request reports all pages as updated today. Search engines and AI crawlers that use `lastmod` for recrawl prioritization lose trust in this signal.

**Fix:** Replace with hardcoded or build-time dates that reflect actual content changes.

### M2 — No author/creator attribution anywhere

The site has zero "made by" attribution — no team page, no creator name, no personal site link. AI models assign higher confidence to content associated with an identified author.

**Fix:** Add a one-line attribution to the footer or About page (e.g., "Made by [name]" with a GitHub/personal site link).

### M3 — Korean-only with no English description layer

No English-language description exists anywhere on the site. AI models cannot form cross-lingual entity nodes for "ottline." An English-language user asking about no-login media tracking apps has zero probability of seeing ottline surfaced.

**Fix:** Add a single English paragraph to the About page and a bilingual meta description. Example: "ottline is a free, no-login web app for logging videos and books. Data is stored in your browser via IndexedDB. Sync across devices with a pairing code."

### M4 — No page-level dates on About and FAQ pages

The privacy policy has a datestamp (2026-02-14), but the FAQ and About pages have no visible "last updated" date. Perplexity AI and Bing Copilot weight visible recency signals from `<time>` elements, not just sitemap timestamps.

**Fix:** Add `<time datetime="YYYY-MM-DD">최종 수정: YYYY.MM.DD</time>` at the top of FAQ and About pages.

### M5 — `/account` and `/timeline` indexed without noindex protection

These pages contain user-specific data and no server-rendered content. They consume crawl budget and generate thin-content signals.

**Fix:** Add `<meta name="robots" content="noindex, nofollow">` to `/account` and `/timeline`.

### M6 — Bing Webmaster Tools not verified despite MS Clarity being installed

`msvalidate.01` meta tag is absent despite Microsoft Clarity being active. Bing Copilot draws from Bing's index, and verification unlocks index trust signals and IndexNow submission.

**Fix:** Verify the site in Bing Webmaster Tools (5-minute task). Implement IndexNow for same-day content update signals.

---

## Low Priority Issues (Optimize When Possible)

### L1 — No explicit AI crawler allow directives in robots.txt

All crawlers are currently allowed via the wildcard `User-agent: *` rule. Adding explicit `User-agent: GPTBot`, `User-agent: ClaudeBot`, `User-agent: PerplexityBot` blocks with `Allow: /` is an emerging best practice that signals intentional openness.

### L2 — LCP risk: hero images use lazy-loading and no fetchpriority

Above-the-fold images on `/about` use `loading="lazy"` without `fetchpriority="high"`. This delays Largest Contentful Paint.

### L3 — Four synchronous inline scripts in `<head>` (INP risk)

GA4, MS Clarity, theme detection, and service worker registration all execute synchronously before page paint, contributing to main-thread contention.

### L4 — Missing BreadcrumbList schema on content pages

`/about`, `/faq`, and `/privacy` have no breadcrumb schema, leaving navigation hierarchy undeclared for search engines.

### L5 — Images likely missing explicit width/height attributes

No `width` and `height` attributes observed on About page images — only Tailwind classes. This contributes to Cumulative Layout Shift.

---

## Category Deep Dives

### AI Citability (42/100)

The FAQ page contains the strongest citation candidates — the IndexedDB/local-first explanation (Q1), the pairing code sync mechanism (Q2), and the conflict resolution logic (Q3) are technically accurate, self-contained, and factual. However, no passage crosses the citation-ready threshold of 70/100 because: (1) no statistical claims exist (no numbers, percentages, or measurable facts), (2) no author attribution adds credibility, and (3) the content is invisible to AI crawlers due to CSR rendering.

The About page tagline ("기억은 흐릿해지지만, 기록은 타임라인으로 남습니다") is evocative but unsourceable by AI — it's a brand statement, not a citable fact.

**Korean language impact:** Korean-only content competes in a dramatically smaller AI retrieval corpus. AI models cannot form confident cross-lingual entity nodes without at least one English-language anchor.

**Best passage to enrich (FAQ Q1):**
> Current: "ottline은 로컬 퍼스트(Local-first) 기술을 사용합니다. 사용자가 입력한 모든 기록은 먼저 브라우저 내부 저장소(IndexedDB)에 저장됩니다."
>
> Enriched: "ottline은 로컬 퍼스트(Local-first) 기술을 사용합니다. 사용자가 입력한 모든 기록은 먼저 브라우저 내부 저장소(IndexedDB)에 저장됩니다. IndexedDB는 최신 브라우저에서 수만 건 이상의 기록을 저장할 수 있으며, 로그인 없이도 데이터가 안전하게 유지됩니다."

---

### Brand Authority (5/100)

No third-party presence was detected across any platform — Wikipedia, Namu.wiki, Reddit, YouTube, GitHub, LinkedIn, Product Hunt, or Korean app directories. The brand exists as a live domain with valid sitemap and working robots.txt, which provides the minimum signal for a score of 5.

This is the single largest constraint on the overall GEO Score. Brand authority has 20% weight in the formula; raising it from 5 to 40 (achievable with Namu.wiki + Product Hunt + alternativeto.net listings) would add 7 points to the composite score.

**Platform presence map:**

| Platform | Status | Priority |
|---|---|---|
| Namu.wiki | Absent | High — most impactful for Korean AI models |
| alternativeto.net | Absent | High — cited by Perplexity for tool comparisons |
| Product Hunt | Absent | High — creates indexed English-language entity |
| YouTube | Absent | Medium — demo video adds multimedia entity signal |
| LinkedIn | Absent | Medium — Microsoft ecosystem anchor for Copilot |
| GitHub | Absent | Low — public repo would establish developer entity |
| Wikipedia (EN) | Not applicable yet | Future — requires notability threshold |

---

### Content E-E-A-T (38/100)

| Dimension | Score | Key Gap |
|---|---|---|
| Experience | 11/25 | No usage data, no user testimonials, no failure/edge-case discussion |
| Expertise | 9/25 | Technically accurate FAQ but no author, no credentials, no architectural rationale |
| Authoritativeness | 6/25 | Zero external citations, no press, no institutional backing |
| Trustworthiness | 16/25 | Privacy policy present, pricing transparent, HTTPS — but no contact path |

The strongest signal is the FAQ's accurate description of the local-first/IndexedDB architecture, which demonstrates genuine product knowledge. The weakest dimension is Authoritativeness — there is simply no external validation of any kind.

The most urgent single fix: add a visible contact path (email or support form). A local-first app that can lose data if a user clears their browser cache, with no support contact anywhere, is a significant trust gap.

---

### Technical GEO (51/100)

| Category | Score | Status |
|---|---|---|
| Server-Side Rendering | 35/100 | Critical — 5/7 pages are CSR |
| Meta Tags & Indexability | 55/100 | High — no canonicals, shared descriptions |
| Crawlability | 75/100 | Medium — clean robots.txt, sitemap lastmod issue |
| Security Headers | 30/100 | High — no headers() in next.config.ts |
| Core Web Vitals Risk | 60/100 | Medium — LCP/INP concerns |
| Mobile Optimization | 90/100 | Good — PWA, viewport, responsive |
| URL Structure | 65/100 | Medium — locale prefix mismatch |
| Response & Status | 80/100 | Good — HTTPS, fast response |

The mobile/PWA implementation is genuinely excellent — the best-scoring area of the entire audit. The PWA manifest, service worker, theme color, and viewport configuration are all correctly implemented and serve as a strong foundation.

The critical technical issue is the RSC/CSR mismatch: `about/page.tsx` correctly uses `getTranslations` (RSC), but the FAQ and Privacy pages — which contain the most important static content — use `useTranslations` in `"use client"` components, making them invisible to AI crawlers.

---

### Schema & Structured Data (4/100)

Absolute zero Schema.org markup on all seven pages. The 4 points are awarded because Open Graph tags confirm basic identity metadata exists.

| Missing Schema | Target Page | Impact |
|---|---|---|
| Organization | Homepage | Entity identity for all AI platforms |
| SoftwareApplication | Homepage | Product classification, rich result eligibility |
| FAQPage | /faq | Structures 6 Q&As for AI extraction |
| WebSite + SearchAction | Homepage | Sitelinks search box signal |
| speakable | /about, /faq | AI assistant readability signal |
| BreadcrumbList | /about, /faq, /privacy | Navigation hierarchy declaration |

All JSON-LD must be server-rendered in the initial HTML. In Next.js App Router, add inside a server component using `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />`. Do not use client-side injection — AI crawlers cannot execute JavaScript.

---

### Platform Optimization (24/100)

| Platform | Score | Status |
|---|---|---|
| Google AI Overviews | 28/100 | Critical |
| ChatGPT Web Search | 18/100 | Critical |
| Perplexity AI | 26/100 | Critical |
| Google Gemini | 25/100 | Critical |
| Bing Copilot | 22/100 | Critical |

All five platforms are in the Critical range. The root cause is the same across all of them: no entity anchors, no schema markup, and no third-party corroboration. This is not a content quality problem — the FAQ answers are concise and accurate. It is entirely a signal layer problem.

The most impactful single action across all five platforms: add Organization + SoftwareApplication JSON-LD to the homepage. This one block improves signals on all five platforms simultaneously.

---

## Quick Wins (Implement This Week)

1. **Create `public/llms.txt`** — 30 minutes, improves Perplexity/ChatGPT/Claude crawler guidance immediately. Template provided in Critical Issues section C3 above.

2. **Convert `faq/page.tsx` to RSC** — Remove `"use client"`, replace `useTranslations` with `getTranslations` from `next-intl/server`. See `about/page.tsx` as the template. This makes all 6 FAQ answers visible to AI crawlers. (~1 hour)

3. **Add FAQPage JSON-LD to `/faq`** — Zero new content required. Transcribe existing Q&As into the schema template provided in Critical Issues C2. (~1 hour)

4. **Add Organization + SoftwareApplication JSON-LD to homepage** — Templates provided in C2. Server-render in the root layout or page component. (~1 hour)

5. **Add security headers to `next.config.ts`** — One `headers()` function block covers all pages. Template provided in H3. (~30 minutes)

---

## 30-Day Action Plan

### Week 1: Make Content Visible to AI Crawlers
- [ ] Convert `faq/page.tsx` from `"use client"` to RSC (use `about/page.tsx` as template)
- [ ] Convert `privacy/page.tsx` from `"use client"` to RSC
- [ ] Create `public/llms.txt` (template in C3 above)
- [ ] Add FAQPage JSON-LD to `/faq` (ready-to-use template in C2 above)
- [ ] Add Organization + SoftwareApplication JSON-LD to homepage (ready-to-use templates in C2)
- [ ] Add security headers to `next.config.ts` (template in H3)

### Week 2: Fix Technical Signal Gaps
- [ ] Add per-page canonical tags in `generateMetadata` for all content pages
- [ ] Fix `og:url` and `og:title` to be page-specific (not always `"ottline"` and root URL)
- [ ] Write unique meta descriptions for `/faq`, `/about`, `/privacy`, `/public`
- [ ] Fix sitemap `lastmod` to use real build-time dates instead of `new Date()`
- [ ] Add `noindex, nofollow` to `/account` and `/timeline`
- [ ] Verify site in Bing Webmaster Tools (add `msvalidate.01`)

### Week 3: Build Brand Entity Presence
- [ ] Create a Namu.wiki article about ottline (key target for Korean AI models)
- [ ] List ottline on alternativeto.net under "Media Tracker" and "Book Tracker"
- [ ] Add creator attribution to footer and About page
- [ ] Add a contact email or support link to About and FAQ pages
- [ ] Add visible "최종 수정일" dates to FAQ and About pages

### Week 4: Content Enrichment and Cross-Lingual Anchoring
- [ ] Add an English-language paragraph to the About page (bilingual anchor for cross-lingual AI retrieval)
- [ ] Enrich FAQ Q1 (IndexedDB explanation) with quantitative specifics (storage limits, record capacity)
- [ ] Add `hreflang` alternate tags for `ko` and `en` across all pages
- [ ] Implement IndexNow for same-day Bing/Copilot freshness signaling
- [ ] Create a YouTube demo video (3-step workflow screen recording)

---

## Appendix: Pages Analyzed

| URL | Title | Rendering | GEO Issues |
|---|---|---|---|
| https://ottline.app | ottline \| 보고, 읽고, 남기다. 나만의 타임라인 | CSR | No schema, no canonical, shared description, CSR content invisible |
| https://ottline.app/about | 서비스 소개 및 사용법 \| ottline | **RSC** ✓ | No schema, no canonical, no author, no date |
| https://ottline.app/faq | 자주 묻는 질문 \| ottline | CSR | No FAQPage schema, CSR content invisible, no canonical |
| https://ottline.app/privacy | Privacy Policy | CSR | CSR content invisible, no canonical, no update date |
| https://ottline.app/timeline | ottline Timeline | CSR | User-specific, should be noindex, no content for AI |
| https://ottline.app/public | ottline Public | CSR | No schema, CSR content invisible |
| https://ottline.app/account | ottline Account | CSR | User-specific, should be noindex, no content for AI |

---

*Generated by GEO Audit on 2026-03-16*
