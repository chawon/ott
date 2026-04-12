# 미래의 타임라인 (LLM 기반 추천)

> 사용자의 시청 기록을 LLM(Claude, Gemini)에게 넘겨 다음에 볼 컨텐츠를 추천받는 기능.  
> 타임라인 페이지에서 "나의 미래는?" 버튼 클릭 시 "미래의 타임라인" 뷰로 전환.

---

## Architecture

```
Timeline Page → "나의 미래는?" 버튼
                    ↓
        GET /api/recommendations?excluded=...
                    ↓
        RecommendationService
          ├── DONE 로그 최근 50개 조회
          ├── RecommendationPromptBuilder (excluded 포함)
          ├── LlmProvider 병렬 호출
          │     ├── AnthropicProvider (claude-opus-4-5)
          │     └── GeminiProvider (gemini-2.5-flash)
          ├── 이름 기준 중복 제거 병합
          ├── TmdbClient.findPosterUrl() 병렬 enrichment
          └── recommendation_cache (24h, user_id PK)
```

---

## API

```
GET /api/recommendations
  Headers: X-User-Id, X-Device-Id, Accept-Language
  Params:
    refresh=true     캐시 무효화 후 재생성 (하루 1회 제한 - 프론트 제어)
    excluded=제목1   이미 본 작품 (중복 파라미터로 여러 개 전달)

Response: RecommendationItem[]
  { name, type, reason, genres[], posterUrl? }

Error:
  503  LLM 키 미설정 또는 모든 provider 실패
  200 []  기록 5개 미만
```

---

## Backend

### 새 파일

| 파일 | 역할 |
|---|---|
| `llm/LlmProperties.java` | `@ConfigurationProperties(prefix = "llm")` |
| `llm/LlmConfig.java` | Anthropic/Gemini RestClient 빈 등록 |
| `llm/LlmProvider.java` | `recommend(prompt)` / `isEnabled()` 인터페이스 |
| `llm/AnthropicProvider.java` | Claude API 호출, `ANTHROPIC_API_KEY` 기반 활성화 |
| `llm/GeminiProvider.java` | Gemini API 호출, `GEMINI_API_KEY` 기반 활성화 |
| `llm/RecommendationItem.java` | `name, type, reason, genres, posterUrl` record |
| `llm/RecommendationPromptBuilder.java` | 히스토리 + excluded → 프롬프트 문자열 |
| `domain/RecommendationCacheEntity.java` | `user_id PK, language, response_json, created_at` |
| `repo/RecommendationCacheRepository.java` | `findByUserId`, `deleteByUserId` |
| `service/RecommendationService.java` | 캐시 조회 → LLM 호출 → TMDB enrichment → 저장 |
| `web/RecommendationController.java` | `GET /api/recommendations` |

### 수정 파일

| 파일 | 변경 내용 |
|---|---|
| `repo/WatchLogRepository.java` | `findTop50ForRecommendation()` JPQL 쿼리 추가 |
| `service/LogService.java` | create/update 시 `invalidateCache()` 호출 |
| `tmdb/TmdbClient.java` | `findPosterUrl(name, type, language)` 추가 |
| `resources/application.yaml` | `llm:` 설정 블록 추가 |
| `resources/db/migration/V22__recommendation_cache.sql` | 캐시 테이블 생성 |

### 환경변수

```
ANTHROPIC_API_KEY=   # Claude API 키 (선택)
GEMINI_API_KEY=      # Gemini API 키 (선택)
ANTHROPIC_MODEL=     # 기본값: claude-opus-4-5
GEMINI_MODEL=        # 기본값: gemini-2.5-flash
```

둘 중 하나 이상 설정 시 활성화. 모두 설정하면 병렬 호출 후 결과 병합.

---

## Frontend

### 수정 파일

| 파일 | 변경 내용 |
|---|---|
| `app/[locale]/timeline/page.tsx` | futureMode 토글, FutureTimelineSection, FutureLoadingSkeleton |
| `lib/types.ts` | `RecommendationItem` 인터페이스 추가 |
| `messages/ko.json` | `Timeline.*` 키 추가 |
| `messages/en.json` | `Timeline.*` 키 추가 |
| `next.config.ts` | `image.tmdb.org` remotePatterns 추가 |

### 주요 UX

- **로딩**: 스켈레톤 카드 4장 + 2초마다 바뀌는 상태 메시지
- **dismiss**: X 버튼("과거에 봤던 작품") → localStorage 저장 → 목록 즉시 숨김
- **excluded 전달**: 새로 추천받기 시 dismissed 목록을 `?excluded=` 파라미터로 전달
- **하루 1회 제한**: `localStorage.watchlog.lastRecommendRefresh` 날짜 체크
- **에러 처리**:
  - 503 (키 없음 / rate limit / 연결 실패) → "미래의 타임라인이 그려지지 않아요."
  - 200 `[]` (기록 부족) → "기록을 5개 이상 남기면 미래를 볼 수 있어요."

---

## 캐시 전략

- DB 테이블 `recommendation_cache` (user_id PK)
- 24시간 유효
- 무효화 조건: 로그 생성/수정 시 자동, "새로 추천받기" 버튼(하루 1회)
- 포스터 URL 포함하여 캐시에 저장
