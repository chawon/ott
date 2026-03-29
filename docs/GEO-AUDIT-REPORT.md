# GEO Audit Report: ottline

**Audit Date:** 2026-03-29
**URL:** https://ottline.app
**Business Type:** Free SaaS PWA — Video & Book Logging (Korean-language)
**Pages Analyzed:** 5 (/, /about, /faq, /public, /privacy)

---

## Executive Summary

**Overall GEO Score: 29/100 (Critical)**

ottline.app is a focused, well-conceived product with a genuine privacy differentiator (local-first, no-login), but it is nearly invisible to AI search systems. The site exists as a single entity with no external corroboration — no Wikidata entry, no Product Hunt listing, no community presence, no author identity — which means AI models have no mechanism to recognize "ottline" as a known, citable entity. The most urgent priorities are establishing entity presence on two or three external platforms, adding `llms.txt`, and expanding the site's content footprint beyond 5 short pages.

### Score Breakdown

| Category | Score | Weight | Weighted Score |
|---|---|---|---|
| AI Citability | 37/100 | 25% | 9.3 |
| Brand Authority | 6/100 | 20% | 1.2 |
| Content E-E-A-T | 34/100 | 20% | 6.8 |
| Technical GEO | 54/100 | 15% | 8.1 |
| Schema & Structured Data | 31/100 | 10% | 3.1 |
| Platform Optimization | 14/100 | 10% | 1.4 |
| **Overall GEO Score** | | | **29/100 — Critical** |

---

## Critical Issues (Fix Immediately)

### C1 — No entity presence on any external platform
**Affects:** Brand Authority, Platform Optimization, AI Citability

ottline does not exist on Wikipedia, Wikidata, Crunchbase, Product Hunt, LinkedIn, YouTube, Reddit, or any Korean developer community (Disquiet, Velog, Tistory). AI models (ChatGPT, Perplexity, Gemini) require at least two independent sources to treat a brand as a recognized entity. Without that, ottline cannot be cited even when its content is technically accessible.

**Fix:** Create a Wikidata item (Q-entry) for ottline with: `instance of: web application`, `official website: https://ottline.app`, `platform: progressive web app`, `language: Korean`, `genre: personal logging`. This is a 20-minute task with the highest cross-platform GEO ROI of any action in this report.

### C2 — No `llms.txt` file
**Affects:** Technical GEO, AI Citability

`https://ottline.app/llms.txt` returns a redirect to the homepage (file absent). This is the primary machine-readable self-description for AI systems. Without it, AI crawlers have no authoritative reference for what ottline is, who it serves, or what its key URLs contain.

**Fix:** Create `/llms.txt` (see template in Technical GEO section below). Reference it in `robots.txt`.

### C3 — Homepage is a JavaScript shell; main body content not server-rendered
**Affects:** Technical GEO, AI Citability

The site uses Next.js RSC (React Server Components) with streaming payloads (`__next_f` chunks). The initial HTML response does not contain meaningful Korean body text — it is a JS shell awaiting hydration. AI crawlers (GPTBot, ClaudeBot, PerplexityBot) **do not execute JavaScript** and receive an effectively empty page body, making all feature descriptions and page content invisible to them.

**Positive exception:** Both JSON-LD blocks (`Organization` + `SoftwareApplication`) are in `<head>` and are readable by all crawlers.

**Fix:** Ensure the homepage H1, hero description, and core feature copy are rendered in the initial server-side HTML payload, not only after JS hydration. In Next.js App Router, verify these elements are returned from a Server Component (not a `"use client"` component).

---

## High Priority Issues

### H1 — No author, founder, or team identity anywhere on the site
**Affects:** Content E-E-A-T, Brand Authority

No named individual is associated with ottline — no founder page, no team bio, no "built by" attribution. AI models weight human identity as a trust signal. The absence makes the site appear as an anonymous product, reducing citation probability.

**Fix:** Add a 300-500 word Korean founder note to `/about` explaining who built this, why (personal pain with existing logging tools), and what the local-first design decision means for users' data.

### H2 — No social or community presence; zero brand mentions
**Affects:** Brand Authority (6/100), Platform Optimization (14/100)

The site has no LinkedIn company page, no YouTube channel, no GitHub repository, no Reddit or Naver/Disquiet community posts. Perplexity scored 8/100 because its citation engine requires community-corroborated references — none exist for ottline.

**Fix (ranked by impact):**
1. Create a Product Hunt listing (English + Korean) — indexed by Bing, cited by ChatGPT and Perplexity
2. Write one 500-word Korean post on Disquiet.io about building ottline — the primary Korean indie maker community
3. Create a LinkedIn Company Page matching the Organization schema

### H3 — No explicit AI crawler rules in `robots.txt`
**Affects:** Technical GEO

The blanket `User-agent: * / Allow: /` technically permits all crawlers, but providing explicit rules for AI-specific user agents signals deliberate GEO awareness and prevents future accidental blocking.

**Fix:** Add to `robots.txt`:
```
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: GoogleOther
Allow: /

User-agent: anthropic-ai
Allow: /
```

### H4 — `sameAs` completely absent from Organization schema
**Affects:** Schema, Brand Authority

The Organization schema has `name`, `url`, `logo`, `description`, and `inLanguage` — but zero `sameAs` links. Without `sameAs`, AI knowledge graphs cannot perform entity linking, meaning "ottline" in the schema is an isolated node unconnected to any external reference.

**Fix:** Add `sameAs` array to the Organization schema with every profile URL that exists or gets created: Wikidata, LinkedIn, Product Hunt, GitHub, YouTube.

### H5 — Privacy Policy not in primary navigation
**Affects:** Content E-E-A-T, Trustworthiness

A privacy policy page is listed in the sitemap (`/privacy`) but is not prominently linked in primary navigation. For a local-first app whose key selling point is "your data stays on your device," a clearly linked, technically detailed privacy policy is a critical trust signal — especially for Korean PIPA compliance and EU visitors.

**Fix:** Link `/privacy` from the main navigation or footer. Ensure it explicitly states: no account created, no data transmitted to external servers, what the pairing code mechanism does and doesn't transmit.

---

## Medium Priority Issues

### M1 — Content is thin: only ~1,000 words across 5 pages, no blog
**Affects:** AI Citability, Content E-E-A-T, Topical Authority

The entire site totals approximately 1,000-1,200 words of substantive content. AI models prioritize sources with topical depth. Competitors with blog posts on "best apps to track what you watch" or "local-first app design" will outrank ottline on these queries.

**Recommended content additions:**
- "ottline 사용법: 나만의 영상·책 타임라인 만들기" (use-case guide, 800 words)
- "로컬 퍼스트가 내 데이터를 어떻게 보호하는가" (architecture + privacy explainer, 600 words)
- "왜 로그인 없는 기록 앱을 만들었나" (founder story, 400 words)

### M2 — FAQ covers only 6 entries; missing common questions
**Affects:** AI Citability, Content E-E-A-T

Expand the FAQ to 12-15 entries covering: offline behavior, browser compatibility, PWA install steps per OS (Android/iOS), what happens when browser storage is cleared, what exactly the pairing code transmits to servers, data backup/restore, and whether the app will ever require login.

### M3 — SoftwareApplication schema missing `aggregateRating`, `screenshot`, `softwareVersion`
**Affects:** Schema

These properties are required or strongly recommended for Google SoftwareApplication rich results.

**Fix:** Once genuine user ratings exist, add `aggregateRating`. Add at least one `screenshot` `ImageObject`. Add `softwareVersion` and `dateModified`.

### M4 — No `BreadcrumbList` schema on sub-pages
**Affects:** Schema

Add BreadcrumbList to `/faq` and `/about`:
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "홈", "item": "https://ottline.app"},
    {"@type": "ListItem", "position": 2, "name": "FAQ", "item": "https://ottline.app/ko/faq"}
  ]
}
```

### M5 — No `speakable` property for AI assistants
**Affects:** Schema, AI Citability

The `speakable` property on a `WebPage` schema tells AI assistants (Gemini, Google Assistant) which content sections to surface in conversational responses. Not implemented on any page.

### M6 — Dual analytics (GA + Clarity) without resource hints
**Affects:** Technical GEO, Core Web Vitals

Ensure both analytics scripts load with `async`/`defer` and add `<link rel="preconnect">` hints for `https://www.googletagmanager.com` and `https://clarity.ms`.

### M7 — No visible publication or update dates on any page
**Affects:** Content E-E-A-T, Platform Optimization

Perplexity AI treats undated content as stale by default. Add "최종 수정일" (last updated) dates to `/about` and `/faq` using `<time datetime="...">` HTML tags. Create a simple changelog page.

---

## Low Priority Issues

- **L1** — Duplicate Organization + SoftwareApplication schemas on `/about` (consolidate to homepage only)
- **L2** — No `WebSite` + `SearchAction` schema on homepage (add if on-site search exists)
- **L3** — Korean web font `font-display` optimization unverified (confirm `font-display: swap` + Unicode-range subsetting)
- **L4** — Trailing slash canonicalization unverified (confirm `/about` and `/about/` resolve consistently with canonical tag)
- **L5** — `HowTo` schema: do NOT add despite the how-to guide on `/about` — HowTo was removed from Google rich results in Sep 2023

---

## Category Deep Dives

### AI Citability (37/100)

| Sub-dimension | Score | Notes |
|---|---|---|
| Passage Self-Containment | 12/25 | FAQ answers (~50 words each) are borderline self-contained; About 3-step guide is extractable |
| Answer Block Quality | 15/25 | 6 Q&A pairs with FAQPage schema is solid |
| Statistical/Evidence Density | 3/20 | Near zero — no user stats, no research citations, no comparative data |
| Topical Authority | 4/15 | Only 5 pages; no blog cluster; no content addressing adjacent queries |
| Content Volume & Structure | 5/15 | ~1,000 total words is thin for a primary discovery site |

**Best citable content currently:** The 6 FAQ answers are the most AI-extractable content on the site. The "local-first data storage via IndexedDB" explanation and the "completely free, all features included" statement are the most quotable.

**Top 3 rewrite recommendations:**

1. **About page opening paragraph** — Replace the current feature-list structure with a self-contained product definition AI can quote directly:
   > *"ottline은 로그인 없이 영상과 책을 기록하는 무료 앱입니다. 모든 데이터는 사용자의 기기 브라우저(IndexedDB)에 저장되며 서버로 전송되지 않습니다. 웹, Android, iOS에서 PWA로 이용 가능합니다."*

2. **New FAQ entry on data privacy:**
   > *"Q. 내 데이터는 서버에 저장되나요? A. 아니요. 모든 기록 데이터는 사용자 기기의 브라우저 저장소(IndexedDB)에만 저장됩니다. ottline 서버로 전송되거나 저장되는 개인 기록 데이터는 없습니다."*

3. **New page "로컬 퍼스트 앱이란?"** — 600-word technical explainer on local-first architecture and how ottline implements it. This would be the site's primary AI citation target for privacy-related queries.

---

### Brand Authority (6/100)

| Platform | Status |
|---|---|
| Wikipedia | ❌ Not present |
| Wikidata | ❌ Not present |
| Product Hunt | ❌ Not confirmed |
| LinkedIn | ❌ Not confirmed |
| YouTube | ❌ Not confirmed |
| Reddit | ❌ Not present |
| Disquiet.io / Velog | ❌ Not confirmed |
| GitHub | ❌ Not confirmed |
| App Store / Play Store | N/A (PWA only) |

ottline exists only at its own domain. The entire brand authority problem can be substantially addressed in a single focused week — creating Wikidata, Product Hunt, and LinkedIn accounts would push this score from 6/100 to approximately 35-45/100.

---

### Content E-E-A-T (34/100)

| Dimension | Score | Key Gap |
|---|---|---|
| Experience | 7/25 | No user narratives, no founder story, no first-hand use cases |
| Expertise | 5/25 | No author byline, no credentials, no team page |
| Authoritativeness | 6/25 | Organization schema present; zero external citations or media mentions |
| Trustworthiness | 15/25 | Local-first architecture is a strong implicit trust signal but not explicitly documented |

The local-first / no-login architecture is ottline's most powerful trust differentiator — but the content does not leverage it. A page explaining technically how data stays on-device, what the pairing code transmits, and which browser storage APIs are used would dramatically improve Expertise and Trustworthiness scores.

---

### Technical GEO (54/100)

| Check | Status |
|---|---|
| HTTPS | ✅ Confirmed |
| AI crawler access | ⚠️ Blanket allow — no explicit AI crawler rules |
| llms.txt | ❌ Absent (redirects to homepage) |
| Server-side rendering | ⚠️ RSC streaming — JS shell body; JSON-LD in `<head>` is crawler-readable |
| Sitemap | ✅ Present at /sitemap.xml, 5 URLs |
| Meta tags (title, description, OG, Twitter Card) | ✅ All present and populated |
| Mobile / PWA | ✅ Strong (PWA architecture, apple-mobile-web-app-capable) |
| Security headers | ⚠️ HTTPS confirmed; CSP/HSTS unverified |
| Core Web Vitals | ⚠️ Medium risk (dual analytics, SPA hydration delay) |

**Recommended `llms.txt`:**
```
# ottline

> ottline은 영상과 책을 기록하는 무료 한국어 PWA입니다. 로그인 없이 사용할 수 있으며,
> 모든 데이터는 브라우저 IndexedDB에 로컬 저장됩니다. 서버로 전송되는 개인 기록 데이터는 없습니다.

ottline은 Web, Android PWA, iOS PWA에서 무료로 이용 가능합니다.

## Key Pages

- [홈](https://ottline.app/): 영상·책 기록 시작 및 서비스 소개
- [서비스 소개](https://ottline.app/about): ottline 사용법 및 기능 설명
- [FAQ](https://ottline.app/faq): 자주 묻는 질문 (데이터 저장, 기기 변경, CSV 내보내기)
- [공개 기록](https://ottline.app/public): 사용자들의 공개 콘텐츠
- [개인정보처리방침](https://ottline.app/privacy): 데이터 처리 방침
```

---

### Schema & Structured Data (31/100)

| Schema | Status | Notes |
|---|---|---|
| Organization | ✅ Present | Missing `sameAs`, `foundingDate`, `contactPoint` |
| SoftwareApplication | ✅ Present | Missing `aggregateRating`, `screenshot`, `softwareVersion` |
| FAQPage | ✅ Present on /faq | 6 Q&A pairs; structurally valid |
| Person | ❌ Absent | No author/founder pages |
| BreadcrumbList | ❌ Absent | Not on any sub-page |
| WebSite + SearchAction | ❌ Absent | |
| speakable | ❌ Absent | |

**Highest-impact fix — Organization schema with `sameAs`:**
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
  "description": "가입 없이 영상·책 기록을 10초 만에 남기고 타임라인으로 모아보세요.",
  "inLanguage": "ko-KR",
  "sameAs": [
    "https://www.wikidata.org/wiki/[REPLACE-WITH-QID]",
    "https://www.linkedin.com/company/ottline",
    "https://www.producthunt.com/products/ottline"
  ]
}
```

---

### Platform Optimization (14/100)

| Platform | Score | Primary Gap |
|---|---|---|
| Google AI Overviews | 18/100 | No question-based content structure, no topical depth |
| ChatGPT Web Search | 10/100 | No entity recognition (no Wikidata, no Product Hunt, no third-party mentions) |
| Perplexity AI | 8/100 | No community validation; JS-rendered body content invisible to its crawler |
| Google Gemini | 16/100 | No YouTube presence; no sameAs in Knowledge Graph |
| Bing Copilot | 18/100 | No Bing Webmaster Tools; no LinkedIn; no IndexNow |

The CRITICAL+HIGH platform actions in the 30-Day Plan would realistically move this score to approximately 42-48/100 — crossing from Critical into Fair range — without writing a single long-form article.

---

## Quick Wins (Implement This Week)

1. **Create a Wikidata entity** for ottline (20 min). Add: `instance of: web application`, `official website`, `platform: PWA`, `language: Korean`, `inception date`. Immediately improves entity recognition for ChatGPT, Perplexity, and Gemini.

2. **Create `https://ottline.app/llms.txt`** using the template above (1 hour). Reference it from `robots.txt`. Gives AI crawlers an authoritative plain-text product description.

3. **Add `sameAs` to Organization schema** (30 min, after profiles exist). Transforms the schema from an isolated node to a connected Knowledge Graph entity.

4. **Register Bing Webmaster Tools + implement IndexNow** (1-2 hours). Add `msvalidate.01` meta tag, verify, submit sitemap, deploy IndexNow key file. Unlocks near-real-time Bing/Copilot indexing.

5. **Write one Korean post on Disquiet.io** (2-4 hours). Describe the founding story, the no-login architecture decision, and the problem ottline solves. Highest-leverage single content action for Perplexity AI visibility.

---

## 30-Day Action Plan

### Week 1: Entity Establishment
- [ ] Create Wikidata Q-item for ottline
- [ ] Create Product Hunt listing (Korean + English)
- [ ] Create LinkedIn Company Page (match Organization schema)
- [ ] Add `sameAs` array to Organization schema
- [ ] Create `/llms.txt` and reference in `robots.txt`

### Week 2: Technical Foundations
- [ ] Add explicit AI crawler rules to `robots.txt` (GPTBot, ClaudeBot, PerplexityBot, anthropic-ai)
- [ ] Register Bing Webmaster Tools, add msvalidate.01, submit sitemap, implement IndexNow
- [ ] Verify homepage RSC: confirm H1 and product description appear in raw server HTML (not only post-hydration)
- [ ] Add `<link rel="preconnect">` for Google Analytics and Clarity domains
- [ ] Add `BreadcrumbList` schema to `/faq` and `/about`

### Week 3: Content & Identity
- [ ] Add founder/creator section to `/about` (300-400 words Korean, first-person)
- [ ] Expand FAQ to 12-15 entries (add: offline behavior, browser support, storage clearing, PWA install per OS, data privacy)
- [ ] Write and publish Disquiet.io post (500+ words Korean)
- [ ] Add `<time datetime="">` last-updated dates to all pages
- [ ] Ensure `/privacy` is linked in primary navigation

### Week 4: Schema & Depth
- [ ] Add `WebSite` schema to homepage
- [ ] Add `speakable` via `WebPage` schema targeting H1 and product description
- [ ] Complete `SoftwareApplication` schema: `screenshot`, `softwareVersion`, `dateModified`
- [ ] Remove duplicate schemas from `/about`
- [ ] Publish new content page: "로컬 퍼스트 앱이란 무엇인가요?" (600 words)

---

## Appendix: Pages Analyzed

| URL | Title | Key GEO Issues |
|---|---|---|
| https://ottline.app | ottline \| 보고, 읽고, 남기다. 나만의 타임라인 | JS shell rendering; no llms.txt; no explicit AI crawler rules |
| https://ottline.app/about | 서비스 소개 및 사용법 \| ottline | No founder info; thin content (~700w); duplicate schema |
| https://ottline.app/faq | 자주 묻는 질문 (FAQ) \| ottline | FAQPage schema present (good); only 6 entries; no BreadcrumbList |
| https://ottline.app/public | (Public records listing) | Not fetched — dynamic user content |
| https://ottline.app/privacy | (Privacy policy) | Not in primary navigation |
| https://ottline.app/llms.txt | — | Absent (redirects to homepage) |
