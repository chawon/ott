# Web/PWA 테마

헤더의 테마 버튼은 `system → light → dark → system` 순으로 전환한다. 선택은 브라우저의 `localStorage(theme-mode)`에 저장한다. 초기값 `system`은 기기의 모양 설정을 따라간다.

[로케일 레이아웃](../../../apps/web/app/%5Blocale%5D/layout.tsx)은 첫 화면이 그려지기 전에 저장된 테마를 읽어 문서의 `dark` 클래스, 배경과 브라우저 테마 색상을 맞춘다. 이후 [ThemeContext](../../../apps/web/context/ThemeContext.tsx)가 테마 변경을 처리한다.

- [헤더 버튼](../../../apps/web/components/AppHeader.tsx)
- [첫 화면 테마 테스트](../../../apps/web/lib/theme-first-paint.test.mjs)
- [디자인 기준](../../../DESIGN.md)
