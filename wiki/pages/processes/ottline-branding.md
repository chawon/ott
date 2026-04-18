# ottline 브랜딩 전환

> ott.preview.pe.kr → ottline.app 도메인 전환 및 브랜드 일괄 적용 작업 (완료)

## 관련 페이지
- [[navigation-auth-migration]]
- [[geo-seo]]
- [[staging]]
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
- `ott.preview.pe.kr`, `ottline.app` TLS 병행 운영

---

## Phase 2: 브랜딩 에셋 적용 (완료)

### 파비콘/아이콘
- `public/favicon.ico`, `icon.png`, `icon-192.png`, `apple-touch-icon.png` 교체

### OG 이미지
- `public/og-image.png` (1200×630) 생성
- **운영 업데이트 (2026-04-18):**
  - 루트 공유용 OG 이미지를 `public/ottline.png` 원본 기준으로 다시 리사이즈한 `public/og-image.png`로 교체
  - 기존 중앙 집중형 카피 레이아웃 대신 브랜드 로고/워드마크 중심 이미지로 단순화

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
- admin analytics 페이지에 구 도메인 잔존 사용 섹션 추가
- **최종 컷오버 (`2026-04-18`):** Cloudflare에서 `ott.preview.pe.kr/*`를 `https://ottline.app/*`로 301 리다이렉트 전환
  - old domain 직접 서빙과 MigrationBanner 기반 자발적 이전 유도는 종료
  - admin analytics의 `migration_complete`와 `oldDomainUsage`는 이력 및 잔존 유입 모니터링용으로 유지

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

## Phase 5: 모바일 앱 (현재 기준)

- Android 배포 기준은 여전히 `apps/twa` 기반 Bubblewrap TWA
- 패키지명은 `app.ottline`, 대상 도메인은 `ottline.app`
- Play internal track 업로드 이력과 GitHub Actions 워크플로우가 유지됨
- Play Console 앱 이름은 `ottline` 고정, `On The Timeline`은 보조 표기로만 사용
- Play 스크린샷/피처 그래픽/설명 문구에서 `ott.preview.pe.kr`와 구 브랜드 자산은 재사용하지 않음
- 연락처 이메일은 `contact@ottline.app`, 개인정보처리방침 URL은 `https://ottline.app/privacy`
- `feat/native-mobile-app`의 React Native + Expo 앱은 별도 후보 브랜치이며, main 미머지 상태
- 문서상 남아 있던 Capacitor 전환 결정은 저장소 코드 실체가 없어 현재 기준에서 제외

자세한 내용: [[twa]], [[native]]

---

## Phase 6: SNS & 커뮤니티 (미완료)

- SNS 프로필 업데이트 (인스타/X 등)
- "ottline.app 정식 오픈" 커뮤니티 공지 글 작성
