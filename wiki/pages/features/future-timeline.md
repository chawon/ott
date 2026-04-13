# 미래의 타임라인 (AI 추천)

> 시청 기록 기반으로 LLM이 다음에 볼 컨텐츠를 추천하는 기능.  
> 타임라인 페이지 "나의 미래는?" 버튼 → "미래의 타임라인" 뷰 전환.

## 관련 페이지
- [[timeline-export]]
- [[book-log]]

---

## UX 흐름

1. 타임라인 상단 **"나의 미래는?"** 버튼 (그라디언트, 로그인 사용자만 노출)
2. 클릭 시 "미래의 타임라인" 뷰로 전환 — 스켈레톤 + 상태 메시지 로딩
3. 추천 카드: 포스터 / 제목 / 타입 뱃지 / 장르 태그 / 추천 이유
4. **"과거에 봤던 작품"** 버튼으로 개별 카드 숨기기 (localStorage 저장)
5. **"새로 추천받기"** — 하루 1회 제한, dismissed 목록을 LLM에 전달해 제외

---

## 제약 조건

| 조건 | 내용 |
|---|---|
| 최소 기록 수 | DONE 상태 기록 **5개 이상** 필요 |
| 이력 범위 | 최근 **3개월** 최대 **50개** |
| 추천 새로고침 | 하루 **1회** (프론트 localStorage 제어) |
| 캐시 | DB 기반 **24시간** (로그 추가/수정 시 자동 무효화) |
| dedup | LLM 결과를 시청 이력 + dismissed 목록과 서버 측 비교 제거 |

---

## 에러 상태

| 상황 | 표시 메시지 |
|---|---|
| 기록 5개 미만 | "기록을 5개 이상 남기면 미래를 볼 수 있어요." |
| LLM 키 없음 / rate limit / 연결 실패 | "미래의 타임라인이 그려지지 않아요." |

---

## LLM 구성

- **Anthropic Claude** (`ANTHROPIC_API_KEY`) + **Google Gemini** (`GEMINI_API_KEY`)
- 두 키 모두 설정 시 **병렬 호출 후 결과 병합** (이름 기준 중복 제거)
- 하나만 설정해도 동작, 둘 다 없으면 503 반환
- 기본 모델: `claude-sonnet-4-6`, `gemini-2.5-flash`

---

## 포스터

- 추천 생성 시 TMDB `searchMulti`로 포스터 URL 병렬 조회
- 포스터 포함하여 캐시 저장 (재조회 없음)
- 책(`book`) 타입은 TMDB 조회 스킵

---

## 구현 위치

**Backend**
- `apps/api/.../llm/` — LlmProvider, AnthropicProvider, GeminiProvider
- `apps/api/.../service/RecommendationService.java`
- `apps/api/.../web/RecommendationController.java`
- `apps/api/.../db/migration/V22__recommendation_cache.sql`

**Frontend**
- `apps/web/app/[locale]/timeline/page.tsx` — FutureTimelineSection, FutureLoadingSkeleton
- `apps/web/lib/types.ts` — RecommendationItem
