# 디자인 리뷰

> ui-ux-pro-max 스킬 기반 ottline UI/UX 점검 및 개선 기록

## 관련 페이지
- [[ux-reviews]]
- [[ux-copy]]

---

## 2026-04-07 점검 결과

**스택**: Next.js + shadcn/ui + Tailwind v4  
**대상 브랜치**: `feature/shadcn-migration`

### 권장 디자인 시스템 (ui-ux-pro-max)

| 항목 | 권장값 | 현재값 |
|------|--------|--------|
| Style | Micro-interactions (소형 애니, 제스처, 촉각 피드백) | transition-all 수준 |
| Colors | Monochrome + blue accent | brand-navy `#1E4D8C` 정의됨 |
| Typography | 개인적·따뜻한 폰트 | Pretendard + Poppins ✅ |

### 발견된 이슈

| 항목 | 심각도 | 상태 | 내용 |
|------|--------|------|------|
| `--primary` 브랜드 컬러 미연결 | 🔴 High | 수정 예정 | `--primary`가 검정(`oklch(0.205 0 0)`)으로 설정 — `--color-brand-navy: #1E4D8C`가 정의됐지만 연결 안 됨. shadcn 버튼/포커스링 등이 브랜드 색을 쓰지 못하는 원인 |
| `cursor-pointer` 전면 누락 | 🔴 High | 수정 예정 | 전체 컴포넌트 0개 적용. 카드·버튼 등 클릭 가능 요소 모두 누락 |
| 다크모드 border 비가시 | 🟡 Medium | 수정 예정 | `.dark`의 `--border: oklch(1 0 0 / 10%)` — 거의 안 보임 |
| 터치 타겟 44px 미달 | 🟡 Medium | 확인 필요 | 아이콘 버튼류 `min-h-[44px]` 적용 여부 미확인 |
| 마이크로 인터랙션 부족 | 🟢 Low | 수정 예정 | hover 피드백 약함, 150-300ms transition 미적용 구간 있음 |

### 수정 계획 (`feature/shadcn-migration` 브랜치)

1. `globals.css` — `--primary` / `--primary-foreground`를 브랜드 네이비로 변경
2. `globals.css` — `.dark` border 불투명도 상향 (`10%` → `20%`)
3. 주요 인터랙티브 컴포넌트 — `cursor-pointer` 일괄 추가
4. 아이콘 버튼 — `min-h-[44px] min-w-[44px]` 적용 확인
