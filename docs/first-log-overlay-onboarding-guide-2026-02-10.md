# 첫 기록 저장 온보딩 가이드 (와이어프레임 오버레이)

## 문서 목적
- 첫 방문 사용자가 `작품 검색 → 기록 저장 → 타임라인 확인`까지 1회에 완료하도록 돕는다.
- 기존 화면을 크게 바꾸지 않고 오버레이만 추가해 이탈을 줄인다.

## 대상 화면
- 홈 기록 입력: `apps/web/components/QuickLogCard.tsx`
- 홈 페이지 컨테이너: `apps/web/app/page.tsx`
- 저장 완료 배너: `apps/web/components/QuickLogCard.tsx:1188`
- 타임라인 진입: `apps/web/app/timeline/page.tsx`

## 목표 지표
- `first_log_completion_rate` 상승
- `time_to_first_log` 단축
- 온보딩 `skip_rate` 모니터링

## 노출 정책
- 최초 1회 자동 노출
- 저장/스킵 시 종료 후 재노출 안 함
- 설정에서 재실행 가능(추후)

권장 키:
- `watchlog.onboarding.firstLog.completed = "1"`
- `watchlog.onboarding.firstLog.skipped = "1"`

## 오버레이 플로우 (3-Step)

### Step 1: 작품 검색
- 타겟: `TitleSearchBox` 입력 필드
- 목적: 사용자가 무엇을 먼저 해야 하는지 명확화
- 안내 문구
- 제목: `먼저 작품을 검색해요`
- 본문: `보고 있거나 읽은 작품 이름을 입력해 주세요.`
- CTA: `다음`

### Step 2: 상태 선택 + 저장
- 타겟: 상태 셀렉트 + 저장 버튼
- 목적: 필수 동작만 강조
- 안내 문구
- 제목: `상태를 고르고 저장해요`
- 본문: `상태를 선택한 뒤 기록 저장 버튼을 눌러 주세요.`
- CTA: `다음`

### Step 3: 타임라인 확인
- 타겟: 저장 완료 배너의 `보기` 링크(개선: `타임라인 보기`)
- 목적: 완료 경험 강화
- 안내 문구
- 제목: `타임라인에서 바로 확인해요`
- 본문: `방금 저장한 기록이 타임라인에 쌓였는지 확인해 주세요.`
- CTA: `완료`

## 와이어프레임 (텍스트)
```text
[Dimmed Background]

   ┌─────────────────────────────┐
   │  작품 검색 입력             │  ← Highlight
   └─────────────────────────────┘

┌────────────────────────────────────────────┐
│ [1/3] 먼저 작품을 검색해요                 │
│ 보고 있거나 읽은 작품 이름을 입력해 주세요. │
│ (건너뛰기)                      [다음]      │
└────────────────────────────────────────────┘
```

## 인터랙션 규칙
1. 공통 컨트롤
- `다음`, `이전`, `건너뛰기`, `닫기`
- 마지막 단계에서 `완료`

2. 배경 처리
- 배경 dim + 포커스 대상만 강조
- 대상 외 영역 클릭 시 다음 단계로 자동 이동하지 않음

3. 스크롤 처리
- 모바일에서 타겟이 화면 밖이면 자동 스크롤 후 콜아웃 표시

4. 종료 조건
- `완료` 클릭
- `건너뛰기` 클릭
- 저장 성공 이벤트 수신 후 Step 3 노출 완료

## 접근성/모션
- 오버레이 컨테이너 `role="dialog"`, `aria-modal="true"`
- 현재 단계 텍스트는 `aria-live="polite"`
- `Esc`로 종료 가능
- 키보드 탭 포커스 트랩 제공
- `prefers-reduced-motion`에서 페이드/슬라이드 애니메이션 비활성화

## UX 카피 기준 (Toss Writing 반영)
1. 해요체 유지
2. 능동형 우선 (`저장해요`, `확인해요`)
3. 부정형 최소화
4. 짧은 동사형 CTA 유지

금지 예시:
- `Error`, `Failed`, `LOADING`, `???`
- `Movie`, `Series`, `Book`

## 구현 제안

### A. 컴포넌트 구조
- `apps/web/components/FirstLogOnboardingOverlay.tsx` 신규
- `apps/web/app/page.tsx`에서 표시 조건 제어

### B. 상태 모델
```ts
type FirstLogOnboardingStep = 1 | 2 | 3;

type FirstLogOnboardingState = {
  open: boolean;
  step: FirstLogOnboardingStep;
};
```

### C. 이벤트 연결
- Step 3 진입 트리거
- QuickLog 저장 성공 시점(`onCreated`)에 overlay step 이동

- 완료 트리거
- `타임라인 보기` 또는 `완료` 클릭 시 localStorage 플래그 저장

### D. 계측 이벤트
- `onboarding_first_log_view`
- `onboarding_first_log_step_next`
- `onboarding_first_log_skip`
- `onboarding_first_log_complete`

## QA 체크리스트
- [ ] 375px/768px/1024px/1440px에서 레이아웃 정상
- [ ] 키보드만으로 단계 이동 가능
- [ ] 스크린리더가 단계 제목/본문을 읽음
- [ ] `prefers-reduced-motion`에서 과한 모션 없음
- [ ] 저장 성공 후 Step 3가 자연스럽게 노출됨
- [ ] `건너뛰기` 후 재접속 시 자동 재노출 안 됨

## 릴리즈 계획
1. 1차: 내부 실험(10%)
- 첫 기록 완료율/스킵률 점검

2. 2차: 전체 배포
- 문구/타겟 포인트 미세 조정

3. 3차: 설정 페이지에 `가이드 다시 보기` 추가
