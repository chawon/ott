# ottline 브랜딩 전환

> ott.preview.pe.kr → ottline.app 도메인 전환 및 브랜드 일괄 적용 작업 (완료)

## 관련 페이지
- [[navigation-auth-migration]]
- [[geo-seo]]
- [[twa]]

---

## 브랜드 스펙

```
브랜드명:       ottline (항상 소문자)
풀네임:         On The Timeline
도메인 (신규):  ottline.app

Primary Color:  #1E4D8C  (Navy)
Accent Color:   #38BDF8  (Cyan)
BG Light:       #F0F6FF
BG Dark:        #0F1E3D

영문 폰트:      Poppins
국문 폰트:      Pretendard

슬로건 (한):    보고, 읽고, 남기다. 나만의 타임라인
슬로건 (영):    Stream. Read. Remember.
태그라인:       Your personal content timeline
```

---

## Phase 1: 도메인 연결 & HTTPS (완료)

- DNS A레코드 → 서버 IP
- Let's Encrypt SSL 인증서 발급
- `ott.preview.pe.kr` → `https://ottline.app` 301 리다이렉트

---

## Phase 2: 브랜딩 에셋 적용 (완료)

### 파비콘/아이콘
- `public/favicon.ico`, `icon.png`, `icon-192.png`, `apple-touch-icon.png` 교체

### OG 이미지
- `public/og-image.png` (1200×630) 생성

### 레트로 모드 완전 제거 (2026-03-15)
- `RetroContext` stub 처리 → 삭제
- `.retro` CSS 블록 전체 제거
- Galmuri 폰트 제거
- `ThemeContext` 레트로 연동 로직 제거

### 브랜드명 표기 통일
- AppHeader, AppFooter, Metadata 등 서비스 전반 → `"ottline"`
- layout.tsx OG siteName, OG url → `https://ottline.app`

---

## Phase 2-1: 마이그레이션 운영 (완료)

- MigrationBanner 문구 업데이트
- `migration_complete` 이벤트 analytics_events 서버 적재
- `/api/admin/analytics/migration-status` 엔드포인트 추가
- admin analytics 페이지에 마이그레이션 현황 섹션 추가
- **결정 (2026-04-05):** 이전율 80% 기준 포기 → **2026-04-15에 301 리다이렉트 전환**
  - 활성 미이전 유저 3명, 20일 경과에도 자연 이전 없음
  - 배너 변경 없이 그대로 유지

---

## Phase 3: PWA 설정 업데이트 (완료)

- `manifest.ts` name/short_name → `"ottline"`
- `background_color` → `"#F0F6FF"`, `theme_color` → `"#1E4D8C"`
- 캐시 키 → `"ottline-cache-v1"`

---

## Phase 4: SEO/GEO 설정 (일부 완료)

- `robots.txt`, `sitemap.xml` ottline.app 기준 정비
- Google Search Console `ottline.app` 등록 + sitemap 제출
- 네이버 서치어드바이저 등록
- FAQ/Privacy RSC 전환, JSON-LD 스키마 추가
- Bing Webmaster Tools 인증 완료
- IndexNow 구현

**남은 작업:** [[geo-seo]] 페이지 참조

---

## Phase 5: 모바일 앱 (결정: TWA → Capacitor)

**2026-03-17 결정:** TWA(bubblewrap) 폐기 → Capacitor로 Android/iOS 통합

자세한 내용: [[twa]]

---

## Phase 6: SNS & 커뮤니티 (미완료)

- SNS 프로필 업데이트 (인스타/X 등)
- "ottline.app 정식 오픈" 커뮤니티 공지 글 작성
