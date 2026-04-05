# 다크 모드

> 기본 모드(비-레트로)에서만 적용되는 라이트/다크/시스템 테마 전환

## 관련 페이지
- [[ux-reviews]]
- [[ottline-branding]]

---

## 동작 규칙

1. **레트로 모드가 켜져 있으면** 다크 모드 적용하지 않음 (레트로 모드는 2026-03-15 완전 제거됨)
2. **레트로 모드가 꺼져 있으면** 테마 모드 적용
   - `system`: 기기 설정에 따라 자동 전환
   - `light`: 항상 라이트
   - `dark`: 항상 다크
3. 토글 순환: `system → light → dark → system`
4. 사용자 선택은 `localStorage(theme-mode)`에 저장

---

## UI 위치

- 헤더 좌측 테마 토글 아이콘
- 레트로 모드에서는 숨김 (현재 레트로 모드 제거 완료)

---

## 컬러 시스템

- 공통 셀렉트 스타일: `.select-base`
- 카드/리스트/드롭다운/바텀시트: `bg-card` / `bg-muted` + `text-foreground` / `text-muted-foreground` 조합

---

## 관련 파일

- `apps/web/context/ThemeContext.tsx`
- `apps/web/components/AppHeader.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/app/globals.css`
