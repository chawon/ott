# 모바일 UX 개선 기록

## 상태
`feature/mobile-ux-improvements` 브랜치에 구현 완료.

이 문서는 모바일 UX 개선 작업의 최종 결정을 기록한다. 목표는 모바일 화면의 상단/하단 네비게이션 혼선을 줄이고, QuickLog의 초기 인지 부담을 낮추며, 데스크톱 브라우저 레이아웃을 깨지 않는 범위에서 터치 타깃을 충분히 확보하는 것이다.

## 범위

변경 영역:

1. 앱 네비게이션과 safe-area 레이아웃
2. QuickLog 점진적 공개
3. 검색/입력 폼 터치 타깃 크기
4. 타임라인, 공개 라운지, 계정, 문의함, PWA 배너의 컨트롤 크기
5. 앱 헤더 언어 변경 버튼의 시각적 무게

API, DB, Sync 계약 변경은 없다. QuickLog가 검색 중심 초기 상태로 바뀌었기 때문에 홈 화면의 QuickLog 접기/펼치기 문구는 제거했다.

## 네비게이션 결정

모바일 하단 네비게이션은 `apps/web/components/BottomNav.tsx`로 분리했고, `apps/web/app/[locale]/layout.tsx`에서 렌더링한다.

최종 동작:

1. 하단 네비게이션은 `matchMedia("(max-width: 639.98px) and (pointer: coarse)")`가 참일 때만 노출한다.
2. 데스크톱 브라우저는 창 폭이 좁아져도 상단 네비게이션을 유지하고 하단 네비게이션을 렌더링하지 않는다.
3. `AppHeader`도 같은 `useMobileBottomNav` 훅을 사용해 실제 모바일/coarse pointer 환경에서만 상단 메뉴를 숨긴다.
4. 하단 고정 UI와 본문 여백은 아래 CSS 변수로 관리한다.
   - `--mobile-safe-area-bottom`
   - `--mobile-bottom-nav-height`
   - `--mobile-bottom-content-padding`
   - `--mobile-bottom-overlay-offset`

초기에는 breakpoint만으로 모바일 네비게이션을 분기했지만, 데스크톱 Chrome/Edge에서 좁은 창일 때 하단 네비게이션이 보이는 문제가 있어 pointer 조건을 함께 사용했다.

## QuickLog 결정

QuickLog는 점진적 공개 방식으로 변경했다.

1. 초기 상태에서는 콘텐츠 타입 탭과 검색창만 보여준다.
2. 작품을 선택한 뒤 상세 입력 폼을 노출한다.
3. QuickLog 초기 상태 자체가 충분히 작아졌으므로 홈 화면의 접기/펼치기 기능은 제거했다.
4. 공유 옵션 카드와 저장 버튼은 항상 1열/2행으로 배치한다. 브라우저별 grid wrapping 차이로 저장 버튼이 뚱뚱해지거나 다른 줄 배치가 생기는 문제를 막기 위한 결정이다.
5. 저장 버튼 높이는 화면 크기별로 분리했다.
   - 모바일: `52px`
   - 데스크톱: `68px`

QuickLog 입력 컨트롤은 최종적으로 약 52px 기준으로 맞췄다. 단, 앱 헤더의 언어 변경 버튼은 너무 도드라져 보인다는 피드백이 있어 본문 컨트롤보다 작게 유지한다.

## 다른 메뉴 조정

같은 터치 타깃 기준을 아래 화면에도 적용했다.

1. `FiltersBar.tsx`: 필터 셀렉트가 모바일에서 더 자연스럽게 쌓이고, 셀렉트 높이를 키웠다.
2. `timeline/page.tsx`: 미래 모드, CSV 내보내기, 뒤로가기, 새로고침, 제외 버튼의 터치 영역을 키웠다.
3. `public/page.tsx`: 공개 라운지 검색창과 정렬 셀렉트의 모바일 터치 영역을 키웠다.
4. `account/page.tsx`: 페어링, 내보내기 범위, 로컬 초기화, 계정 삭제, 기기 해제 버튼의 높이와 모바일 줄바꿈을 정리했다.
5. `FeedbackInbox.tsx`: 문의 카테고리, 제목, 제출 버튼의 터치 영역을 키웠다.
6. `TitleSearchBox.tsx`: 검색 입력 높이를 키우고, 결과 패널 높이가 하단 네비게이션 여백을 고려하도록 했다.
7. `PwaInstallBanner.tsx`: 배너 하단 위치가 모바일 하단 네비게이션 safe-area 변수와 맞물리도록 했다.

## 높이 기준

최종 적용 기준:

1. 헤더 언어 버튼: 본문 주요 컨트롤보다 작게 유지
2. 일반 입력/셀렉트: 최소 48px
3. QuickLog 주요 입력/버튼: 약 52px
4. 본문 주요 액션 버튼: 52px
5. QuickLog 저장 버튼: 모바일 52px, 데스크톱 68px
6. 데스크톱 하단 네비게이션: 렌더링하지 않음

## 검증

통과한 명령:

```bash
npx tsc --noEmit --pretty false
npx biome check components/QuickLogCard.tsx components/FiltersBar.tsx app/[locale]/timeline/page.tsx app/[locale]/public/page.tsx app/[locale]/account/page.tsx components/FeedbackInbox.tsx components/TitleSearchBox.tsx components/PwaInstallBanner.tsx
npm run build --workspace ott
```

참고:

1. 현재 루트/웹 package scripts에는 `npm run test`가 없어 실행하지 못했다.
2. 더 넓게 Biome을 돌리면 poster 렌더링의 기존 `<img>` 성능 경고가 남아 있다. 이번 높이/레이아웃 조정에서 새로 만든 경고는 아니다.
3. 빌드 중 기존 `baseline-browser-mapping` 및 multiple lockfile workspace root 경고가 출력된다.
