# 개발 계획: ottline 브랜딩 Phase 2

> **브랜치**: `feat/ottline-branding-phase2`
> **기준일**: 2026-03-15
> **영향 범위**: UI (프론트엔드만)

---

## 목표

1. 신규 아이콘(`ottline_logo.png`) → 파비콘/앱 아이콘 교체
2. 신규 워드마크(`ottline.png`) → 헤더 로고+텍스트 교체
3. 레트로 모드 완전 제거

---

## 입력 에셋

| 파일 | 사이즈 | 용도 |
|------|--------|------|
| `public/ottline_logo.png` | 297×298 | 파비콘/PWA 아이콘 원본 |
| `public/ottline.png` | 1694×683 | 헤더 워드마크 |

---

## 작업 항목

### Task 1. 파비콘/앱 아이콘 생성 및 교체

`ottline_logo.png`(297×298)를 아래 규격으로 변환:

| 파일 | 크기 | 용도 |
|------|------|------|
| `public/favicon.ico` | 32×32 | 브라우저 탭 아이콘 |
| `public/icon-192.png` | 192×192 | PWA 홈화면 아이콘 |
| `public/icon.png` | 512×512 | PWA 스플래시 / 메타 |
| `public/apple-touch-icon.png` | 180×180 | iOS 홈화면 아이콘 |

생성 도구: `imagemagick` (`convert` 명령)

### Task 2. 헤더 워드마크 교체 (`AppHeader.tsx`)

**현재 구조:**
```
[button(icon.png)] [Link("On the Timeline")] [테마토글버튼]
```

**변경 후:**
```
[Link(ottline.png 이미지)] [테마토글버튼]
```

- `ottline.png`를 `<img>`로 표시 (CSS height 고정: `h-8` = 32px, width auto)
- Link는 홈(`/`)으로 유지
- 레트로 토글 버튼 제거

### Task 3. 레트로 모드 완전 제거

제거 대상:

| 파일 | 작업 |
|------|------|
| `context/RetroContext.tsx` | 파일 삭제 |
| `app/[locale]/layout.tsx` | RetroProvider 제거, retro 초기화 스크립트 제거 |
| `components/AppHeader.tsx` | isRetro 분기 전부 제거, 심플하게 단일 렌더링 |
| `app/globals.css` | `.retro` 클래스 블록 전체 제거 |
| `messages/ko.json` | retro 관련 키 제거 (titleRetro, navLog/Timeline/Public/AccountRetro 등) |
| `messages/en.json` | 동일 |
| `public/fonts/Galmuri*` | 레트로 전용 폰트 파일 삭제 |

ThemeContext는 레트로 연동 로직 제거 후 유지.

---

## 검증 시나리오

1. 브라우저 탭에 새 파비콘(`ottline_logo`) 표시
2. 헤더에 `ottline.png` 이미지 렌더링 (모바일/데스크톱 레이아웃 깨짐 없음)
3. 레트로 관련 버튼/텍스트/스타일 흔적 없음
4. 다크모드 테마 전환 정상 동작
5. 네비게이션 링크 4개 정상 동작
6. `npm run lint` 통과 (RetroContext import 잔재 없음)
7. 테스트 서버: `172.24.75.199:3000`

---

## 범위 외 (이번 작업 제외)

- 컬러 시스템 변경 (Tailwind config)
- 폰트 교체 (Poppins/Pretendard)
- 슬로건 텍스트 적용
- OG 이미지 교체
- manifest.json 도메인 변경
