# ottline 도메인 전환 + 브랜딩 적용 작업 지시서

> **대상:** Claude Code
> **목적:** `ott.preview.pe.kr` → `ottline.app` 도메인 전환 및 브랜딩 일괄 적용
> **우선순위:** Phase 순서대로 진행. 각 Phase 완료 후 다음 단계로 이동

---

## 브랜드 스펙 (작업 기준값)

```
브랜드명:       ottline (항상 소문자)
풀네임:         On The Timeline
도메인 (신규):  ottline.app
도메인 (구):    ott.preview.pe.kr

Primary Color:  #1E4D8C  (Navy)   — RGB(30, 77, 140)
Accent Color:   #38BDF8  (Cyan)   — RGB(56, 189, 248)
BG Light:       #F0F6FF           — RGB(240, 246, 255)
BG Dark:        #0F1E3D           — RGB(15, 30, 61)
White:          #FFFFFF

영문 폰트:      Poppins (Bold/Regular/Light)
국문 폰트:      Pretendard (Bold/Regular/Light)

슬로건 (한국어): 보고, 읽고, 남기다. 나만의 타임라인
슬로건 (영문):   Stream. Read. Remember.
서브 슬로건:     내가 본 모든 것, 하나의 타임라인으로
태그라인:        Your personal content timeline

Title 태그 형식: ottline | On The Timeline
```

---

## Phase 1. 도메인 연결 & HTTPS

### 작업 목표
`ottline.app`을 서버에 연결하고 HTTPS를 적용한다.

### 체크리스트
- [x] DNS A레코드 또는 CNAME을 현재 서버 IP로 설정
- [x] Let's Encrypt SSL 인증서 발급 및 HTTPS 적용
- [x] `ott.preview.pe.kr` → `https://ottline.app` 301 리다이렉트 설정

---

## Phase 2. 브랜딩 에셋 적용

### 작업 목표
새 ottline 브랜딩 에셋을 서비스 전반에 적용한다.

### 파비콘 교체
- [x] `/public/favicon.ico` 교체 (ottline_logo.png 기반, 16/32/48px 멀티사이즈)
- [x] `/public/icon.png` 교체 (512×512)
- [x] `/public/icon-192.png` 교체 (192×192)
- [x] `/public/apple-touch-icon.png` 교체 (180×180)
- [ ] `/public/favicon-16x16.png`, `favicon-32x32.png`, `favicon-64x64.png` 별도 파일 생성 (현재 favicon.ico 내에 멀티사이즈로 통합됨, 필요시 분리)

### OG 이미지 교체
- [x] `/public/og-image.png` 생성 (1200×630, ottline 브랜드 컬러 + 로고)
- [ ] `/public/og-image-dark.png` 추가 (다크모드용, 선택)

### 컬러 시스템 적용
- [x] CSS 변수(`--color-brand-navy`, `--color-brand-cyan` 등) globals.css @theme에 등록

### 폰트 적용
- [x] Poppins Google Fonts CDN import 추가 (`globals.css`)
- [x] Pretendard CDN import 유지
- [x] Galmuri(레트로 전용) 폰트 import 제거

### 레트로 모드 제거
- [x] `RetroContext` stub 처리 (isRetro 항상 false)
- [x] `.retro` CSS 블록 전체 제거
- [x] `ThemeContext` 레트로 연동 로직 제거
- [x] `layout.tsx` RetroProvider 및 레트로 초기화 스크립트 제거

### 브랜드명 표기 통일
- [x] `AppHeader`, `AppFooter` titleModern → `"ottline"`
- [x] `Metadata` titleDefault/titleTemplate → ottline 기준
- [x] About, FAQ, Privacy, 공유카드 watermark 등 서비스 내 "On the Timeline" 문구 → `ottline` 일괄 변경 (ko/en)
- [x] layout.tsx OG siteName, appleWebApp title → `"ottline"`
- [x] OG url → `https://ottline.app`

### 헤더 로고
- [x] 아이콘(ottline_logo.png) + ottline 텍스트(#1E4D8C) + On the Timeline 서브텍스트(#38BDF8) 조합으로 교체
- [ ] 최종 브랜드 이미지 에셋(ottline.png) 크롭 완료 시 이미지로 교체 예정

### 슬로건 적용
- [x] 랜딩 페이지 hero 슬로건: ko `보고, 읽고, 남기다.` / en `Stream. Read. Remember.`
- [x] hero 서브텍스트: ko `나만의 타임라인` / en `Your personal content timeline`
- [ ] 서비스 소개 영역 서브 슬로건(`내가 본 모든 것, 하나의 타임라인으로`) 별도 노출 검토

---

## Phase 2-1. 마이그레이션 운영

### 체크리스트
- [x] `MigrationBanner` 문구 업데이트: "서비스 주소가 ottline.app으로 바뀌었습니다" 명시
- [x] `migration_complete` 이벤트 analytics_events 서버 적재 (migration-helper 완료 시점)
- [x] `/api/admin/analytics/migration-status` 엔드포인트 추가 (활성유저 대비 이전율 집계)
- [x] admin analytics 페이지에 마이그레이션 현황 섹션 추가 (이전율, 일별 추이)
- [x] admin analytics 페이지에 domain(hostname) 별 접속 현황 추가
- [ ] 이전율 80%+ 확인 후 `ott.preview.pe.kr` → 301 리다이렉트 전환

> 마이그레이션 배포 이전 완료 사용자는 집계 불가 (배포 시점부터 카운트)

---

## Phase 3. PWA 설정 업데이트

### manifest.ts
- [x] `name` → `"ottline"`
- [x] `short_name` → `"ottline"`
- [x] `background_color` → `"#F0F6FF"`
- [x] `theme_color` → `"#1E4D8C"`
- [x] `description` → 브랜드 슬로건 적용 (ko: "보고, 읽고, 남기다. 나만의 타임라인" / en: "Stream. Read. Remember. Your personal content timeline")
- [x] `icons` 배열 → 새 ottline 아이콘으로 교체 완료 (icon-192.png, icon.png)

> `start_url`, `scope`는 상대경로(`"/"`) 유지 중. 도메인 고정 필요 시 변경.

### Service Worker
- [x] 캐시 키 이름 업데이트 (`"ott-pwa-v2"` → `"ottline-cache-v1"`)
- [ ] 구 도메인 캐시 정리 로직 추가 (선택)

### 메타태그 (`layout.tsx`)
- [x] `<title>` → `ottline | ...` (titleDefault/titleTemplate 반영)
- [x] `<meta name="theme-color">` → `#1E4D8C`
- [x] OG/Twitter 태그 → ottline.app 기준 완료
- [x] `<link rel="canonical">` → about/faq/privacy 페이지별 적용 완료

---

## Phase 4. SEO / GEO 설정

### SEO 기본
- [x] `robots.txt` 확인 — sitemap 경로 ottline.app 기준 확인
- [x] `sitemap.xml` — ottline.app 기준, 실제 날짜 적용, /account·/timeline 제거
- [ ] 구글 서치 콘솔 `ottline.app` 신규 속성 등록 및 sitemap 제출
- [ ] 구글 서치 콘솔 기존 속성(`ott.preview.pe.kr`)에서 "주소 변경" 제출
- [ ] 네이버 서치어드바이저 `ottline.app` 등록 및 사이트맵 제출

### GEO (AI 검색 최적화) — 감사 결과 30/100, 상세 내용: `GEO-AUDIT-REPORT.md`

#### Week 1 완료 (2026-03-17)
- [x] `faq/page.tsx` → RSC 전환 (`"use client"` 제거, `getTranslations` 서버 적용)
- [x] `privacy/page.tsx` → RSC 전환
- [x] FAQPage JSON-LD 스키마 추가 (`/faq`)
- [x] Organization + SoftwareApplication JSON-LD 추가 (layout.tsx `<head>`)
- [x] 보안 헤더 추가 (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [x] `public/llms.txt` 생성 — AI 크롤러 사이트 구조 안내

#### Week 2 완료 (2026-03-17)
- [x] about/faq/privacy `generateMetadata`에 `alternates.canonical` 추가
- [x] about/faq/privacy og:url, og:title 페이지별 개별 적용
- [x] sitemap lastmod `new Date()` → 실제 날짜로 수정
- [x] `/account`, `/timeline` X-Robots-Tag noindex 적용
- [x] Bing Webmaster Tools 인증 완료 (Google Search Console 연동)
- [x] IndexNow 구현 (`scripts/ping-indexnow.mjs`, `npm run indexnow`)

#### 남은 GEO 작업 (코드 외 — 직접 진행)
- [ ] 나무위키 ottline 문서 등록 (한국 AI 모델 브랜드 인식에 가장 큰 영향)
- [ ] alternativeto.net 등록 (Media Tracker / Book Tracker 카테고리)
- [ ] Product Hunt 런칭 (영문 엔티티 앵커 생성)
- [ ] About/FAQ 페이지에 연락처(이메일 또는 피드백 링크) 노출
- [ ] hreflang 태그 추가 (ko/en 언어 신호)
- [ ] About 페이지에 영문 설명 단락 추가 (크로스링귀얼 AI 인식)

---

## Phase 5. TWA / 스토어 업데이트

### assetlinks.json
- [ ] `https://ottline.app/.well-known/assetlinks.json` 생성/업데이트
- [ ] `/.well-known/` 경로 서버 접근 가능 여부 확인

### 플레이스토어
- [ ] TWA `assetLinkUrl` → `https://ottline.app` 변경
- [ ] 앱 아이콘 교체 (ottline_logo.png 기반)
- [ ] 스토어 등록 정보 업데이트 (앱 이름, 설명, 스크린샷)
- [ ] 업데이트 버전 빌드 및 제출

### 기타 스토어
- [ ] Microsoft Store — PWABuilder에서 `ottline.app` URL로 재패키징 후 제출
- [ ] Galaxy Store, 원스토어 — 해당 시 URL 및 브랜딩 소재 변경

---

## Phase 6. SNS & 커뮤니티 업데이트

### 체크리스트
- [ ] SNS 프로필 업데이트 (인스타/X 등) — 아이콘, 이름, 링크, 소개
- [ ] 기존 커뮤니티 홍보 글 링크 수정 (에펨코리아 등, 가능한 것만)
- [ ] "ottline.app 정식 오픈" 커뮤니티 공지 글 작성

---

## 완료 확인 기준

```
☑ https://ottline.app 정상 접속 (HTTPS)
☑ http://ott.preview.pe.kr → https://ottline.app 리다이렉트 정상 동작
☑ 파비콘 새 아이콘(ottline_logo)으로 표시
☑ 링크 공유 시 OG 이미지(ottline 브랜드) 노출
☑ 서비스 내 브랜드명 ottline 통일
☑ PWA manifest name/short_name "ottline"으로 표시
☑ FAQ/Privacy 페이지 AI 크롤러 접근 가능 (RSC 전환 완료)
☑ JSON-LD 스키마 적용 (Organization, SoftwareApplication, FAQPage)
☑ Bing Webmaster Tools 인증 완료
□ 구글 서치 콘솔 ottline.app 색인 요청 완료
□ TWA 앱 실행 시 브라우저 UI 없이 정상 표시
□ 플레이스토어 앱 이름 / 아이콘 새 버전으로 업데이트
```
