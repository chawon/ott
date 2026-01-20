# UI 카피/UX 업데이트 (2026-01-20)

## 개요
일반 모드(비레트로) 문구를 **친근 존댓말(해요체)**로 통일하고, 홈/설정/상세 문구를 짧고 일관되게 정리했다. 또한 QuickLog(홈 입력)에서 공유 옵션과 위시리스트 상태 UX를 개선했다.

## 변경 사항
### 1) 홈 헤드라인 축약
- 문구: “로그인 없이 바로 남기는 시청 기록” → “바로 남기는 나의 시청 기록”
- 파일: `apps/web/app/page.tsx`

### 2) 설정(계정) 문구 해요체 통일
- 상태/알림 문구들을 해요체로 수정
- 로컬 초기화 설명 문구를 정중하게 변경
- 파일: `apps/web/app/account/page.tsx`

### 3) 상세 페이지(작품) 문구 해요체 통일
- 히스토리 안내 문구를 해요체로 변경
- 파일: `apps/web/app/title/[id]/page.tsx`

### 4) QuickLog 공유 옵션 한 줄 배치 + 체크박스 크기 조정
- “함께 기록에 공유” → “함께 기록 공유” (라벨 단축)
- 공유 옵션 체크박스를 한 줄로 배치
- 모바일에서 체크박스 크기 확대
- 파일: `apps/web/components/QuickLogCard.tsx`

### 5) WISHLIST(보고 싶어요) 상태 UI/UX 개선
- 평점/장소/누구와 선택 비활성화
- 비활성화 상태 시 시각적 표시(불투명/커서)
- 파일: `apps/web/components/QuickLogCard.tsx`

## 커밋 히스토리
- `2d5a151` Shorten home headline copy
- `8ef3081` Normalize casual copy to friendly polite tone
- `918af42` Politen account reset copy
- `8769fde` Refine share options layout and wishlist disabled styling

