# 다크 모드 (기본 모드 전용)

## 목표
- 기본 모드(비-레트로)에서만 다크 모드를 적용한다.
- 기본 상태는 OS/브라우저 설정(`prefers-color-scheme`)을 따른다.
- 사용자가 토글로 라이트/다크/시스템 모드를 순환 선택할 수 있다.

## 동작 규칙
1. 레트로 모드가 켜져 있으면 다크 모드를 적용하지 않는다.
2. 레트로 모드가 꺼져 있으면 테마 모드를 적용한다.
   - system: 기기 설정에 따라 자동 전환
   - light: 항상 라이트
   - dark: 항상 다크
3. 토글은 `system -> light -> dark -> system` 순환.
4. 사용자 선택은 `localStorage(theme-mode)`에 저장한다.

## UI 위치
- 헤더 좌측에 테마 토글 아이콘 표시 (레트로 모드에서는 숨김).

## 적용 메모
- 공통 셀렉트 스타일은 `.select-base`로 통일하고, `bg-card`/`text-foreground`를 기반으로 테마에 따라 자동 반영한다.
- 카드/리스트/드롭다운/바텀시트는 `bg-card`/`bg-muted` + `text-foreground`/`text-muted-foreground` 조합을 기본으로 사용한다.

## 참고 파일
- `apps/web/context/ThemeContext.tsx`
- `apps/web/components/AppHeader.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/app/globals.css`
