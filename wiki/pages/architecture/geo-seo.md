# GEO/SEO 최적화

> AI 검색 엔진(GEO)과 일반 SEO 관점에서 ottline.app의 현황 및 개선 계획

## 관련 페이지
- [[i18n]]
- [[ottline-branding]]
- [[pwa]]

---

## 감사 결과 (2026-03-29 기준)

**전체 GEO 점수: 29/100 (Critical)**

| 카테고리 | 점수 | 가중 점수 |
|---|---|---|
| AI Citability | 37/100 | 9.3 |
| Brand Authority | 6/100 | 1.2 |
| Content E-E-A-T | 34/100 | 6.8 |
| Technical GEO | 54/100 | 8.1 |
| Schema & Structured Data | 31/100 | 3.1 |
| Platform Optimization | 14/100 | 1.4 |

---

## 핵심 문제

### C1 — 외부 플랫폼 엔티티 부재
- Wikidata 등재 시도했으나 현재 검색 불가 (삭제된 것으로 추정)
  - Wikidata는 독립된 외부 출처 없으면 편집자가 삭제함
- **확보된 외부 출처**: GeekNews(뉴스하다) — https://news.hada.io/topic?id=25921
- Wikidata 재등재 시 위 링크를 참조 URL로 사용 가능
- 추가 출처 확보 시 더 안정적: alternativeto.net 등록 권장
- **해결 순서**: Wikidata 재등재 (GeekNews를 출처로) → alternativeto.net 추가 등록

### C2 — `llms.txt` 부재 (해결 완료, 2026-03-17)
- `/llms.txt` 파일 생성으로 AI 크롤러에 사이트 구조 안내

### C3 — 홈페이지 JS 셸 렌더링
- Next.js RSC 스트리밍 방식으로 AI 크롤러(GPTBot, ClaudeBot 등)가 본문 텍스트를 읽지 못함
- JSON-LD는 `<head>`에 있어 크롤러 가독 가능
- **해결책**: 핵심 본문 텍스트를 Server Component에서 직접 렌더링

---

## 완료된 기술 개선 (2026-04-13)

### Naver 미노출 수정

- **원인**: `localePrefix: "always"` (next-intl 기본값)으로 인해 사이트맵의 모든 URL이 307 Temporary Redirect 반환
  - `https://ottline.app` → 307 → `https://ottline.app/ko`
  - Naver Yeti는 307 리다이렉트 페이지를 색인하지 않음 → `색인 허용 여부: 아니오`
- **수정**: `i18n/routing.ts`에 `localePrefix: "as-needed"` 추가
  - 기본 언어(ko) URL이 prefix 없이 루트에서 200 직접 서빙
  - 사이트맵 URL(`/`, `/about`, `/faq` 등)과 실제 서빙 URL 일치
  - 기존 `/ko/...` 링크는 `/...`로 308 리다이렉트 (SEO 영향 없음)
- 배포 후 네이버 서치어드바이저에서 수집 재요청 필요

---

## 완료된 기술 개선 (2026-03-17)

### Week 1
- `faq/page.tsx`, `privacy/page.tsx` → RSC 전환 (`"use client"` 제거)
- FAQPage JSON-LD 스키마 추가 (`/faq`)
- Organization + SoftwareApplication JSON-LD 추가 (`layout.tsx <head>`)
- 보안 헤더 추가 (X-Frame-Options, X-Content-Type-Options 등)
- `public/llms.txt` 생성

### Week 2
- 주요 페이지에 `alternates.canonical` 추가
- `sitemap.xml` lastmod 실제 날짜로 수정
- `/account`, `/timeline` X-Robots-Tag noindex 적용
- Bing Webmaster Tools 인증 완료 (Google Search Console 연동)
- IndexNow 구현 (`scripts/ping-indexnow.mjs`, `npm run indexnow`)

---

## 남은 코드 외 작업

1. 나무위키 ottline 문서 등록 (한국 AI 모델 브랜드 인식에 가장 큰 영향)
2. alternativeto.net 등록 (Media Tracker / Book Tracker 카테고리)
3. Product Hunt 런칭 (영문 엔티티 앵커 생성)
4. ~~About/FAQ 페이지에 연락처 노출~~ (완료 — Footer에 contact@ottline.app 추가, CF 이메일 라우팅 설정 완료)
5. ~~hreflang 태그 추가~~ (완료)
6. About 페이지에 영문 설명 단락 추가

---

## Schema.org 현황

| 스키마 | 상태 | 주요 미흡 |
|---|---|---|
| Organization | 있음 | `sameAs` 없음, `foundingDate` 없음 |
| SoftwareApplication | 있음 | `aggregateRating`, `screenshot`, `softwareVersion` 없음 |
| FAQPage | 있음 (6개 Q&A) | 항목 수 부족 |
| Person | 없음 | 창업자/팀 정보 없음 |
| BreadcrumbList | 없음 | 서브 페이지 전체 미적용 |

---

## robots.txt AI 크롤러 명시 (완료)

GPTBot, ClaudeBot, anthropic-ai, PerplexityBot, GoogleOther 명시 허용 완료.
`llms.txt`도 함께 제공 중 (`https://ottline.app/llms.txt`).
