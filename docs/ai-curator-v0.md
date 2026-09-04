# AI 큐레이터 v0 설계

상태: Slice 1·2 구현 완료, 운영 배포 전
브랜치: `feat/ai-curator-v0`

## 1. 문제 정의

실제 이용자가 적고 공개 기록이 거의 없는 시기에 `/public`과 제목 상세의 빈 상태가 서비스의 부재감으로 느껴질 수 있다.

AI가 실제 사람인 것처럼 기록과 댓글을 남겨 숫자를 채우는 방식은 사용자의 신뢰와 제품 통계를 함께 훼손한다. v0의 목적은 사람 수를 부풀리는 것이 아니라, 사람이 들어왔을 때 읽고 반응할 만한 첫 대화 소재를 제공하는 것이다.

## 2. 운영 원칙

### 주체

- `HUMAN`: 페어링 계정을 가진 실제 사용자. 기존 기록·댓글·리액션 규칙을 그대로 적용한다.
- `AI_CURATOR`: ottline이 운영하는 공개 AI 주체. 실제 이용자나 시청 경험을 주장하지 않는다.
- `SYNTHETIC_TEST`: 스테이징·로컬에서만 사용하는 가상 트래픽. 운영 DB에 배포하지 않는다.

### 절대 하지 않는 것

- AI를 일반 `users` 행으로 만들지 않는다.
- AI 활동을 `app_open`, `log_create`, `first_log_create`, WAU, 활성 사용자로 집계하지 않는다.
- AI가 “내가 봤어요”, “내가 읽었어요”처럼 개인 경험을 주장하지 않는다.
- AI가 사람의 리액션·팔로우·알림·조회수를 생성하지 않는다.
- 사람의 개인 타임라인, 메모, 프로필, 문의, 복구 코드에 접근하지 않는다.
- 사람 댓글을 읽지 않은 상태에서 선제 DM이나 반복 알림을 보내지 않는다.

## 3. 사용자 경험

현재 사람의 공개 기록 목록과 AI 콘텐츠를 같은 사회적 증거로 섞지 않는다.

공개 화면의 구조는 다음을 우선한다.

1. `ottline 큐레이터` 섹션: AI가 만든 질문·작품 맥락. 카드마다 `AI 운영 계정` 표시.
2. `사람들이 남긴 기록` 섹션: 실제 사용자의 공개 기록.
3. 사람이 없을 때의 빈 상태: “아직 함께 기록이 없어요”와 첫 기록 CTA를 유지.

AI 콘텐츠는 작품 메타데이터와 공개적으로 확인 가능한 작품 정보만 바탕으로 짧은 질문이나 대화 소재를 만든다. 작품의 줄거리·출연진 등 외부 원문을 길게 복사하지 않는다.

## 4. v0 범위

### 포함

- 한국어를 우선으로 한 AI 큐레이터 주체 1개.
- 관리자가 선택한 작품에 대한 질문형 공개 콘텐츠 생성.
- AI 표시, 생성 시각, 콘텐츠 상태(`DRAFT`, `PUBLISHED`, `DISABLED`).
- 사람이 콘텐츠를 본 뒤 실제 기록·댓글로 이어졌는지 측정.
- 관리자에서 초안 검토·게시·비활성화.

### 제외

- 완전 자율적인 다중 AI 사용자 군집.
- AI 계정의 시청·독서 기록 생성.
- AI 리액션으로 인기 순위나 댓글 수를 조작하는 행위.
- 사람 댓글에 대한 자동 답변(다음 수직 슬라이스에서 별도 검토).
- 추천 알고리즘이나 개인화 점수 모델.

## 5. 모듈과 인터페이스

AI 콘텐츠 모듈은 기존 인증·기록 모듈과 별도 seam을 둔다.

### 외부 인터페이스

```text
createDraft(input) -> Draft
publish(draftId) -> PublishedContent
disable(contentId) -> DisabledContent
listPublic(locale, limit) -> PublicCuratedContent[]
```

호출자는 모델, 프롬프트, 중복 방지, 예약, 감사 로그의 구현을 알지 않는다. 모델 호출은 `TextGenerator` adapter로 숨겨 테스트에서 결정적 fake로 교체한다.

### 권장 저장 구조

`users`와 `comments.user_id`를 재사용하지 않고 별도 시스템 주체를 둔다.

```text
system_actors
  id, key, type, display_name, disclosure, active, created_at

curated_contents
  id, actor_id, title_id, locale, kind, body, status,
  model, prompt_version, source_json, content_hash,
  published_at, created_at, updated_at
```

`kind`는 v0에서 `PROMPT`만 사용한다. 이후 사람 댓글에 답하는 기능을 넣을 때 `REPLY`와 `reply_to_comment_id`를 추가한다.

기존 댓글 작성 경로는 `userId`가 있고 기본 `syncLog=true`일 때 시청 기록과 히스토리를 생성할 수 있으므로, AI 게시물을 기존 댓글 API로 우회 생성하지 않는다.

## 6. 분석 계약

AI 이벤트는 기존 제품 이벤트와 분리한다.

```text
curated_impression
curated_open
curated_human_action
```

공통 속성에는 다음을 추가할 수 있다.

```text
actorType: human | ai_curator
contentOrigin: human | ai_curator
curatedContentId
```

기본 관리자 지표에는 AI 주체를 제외한다. 별도 카드에서 다음을 본다.

- AI 콘텐츠 노출 수
- AI 콘텐츠를 본 세션 중 실제 검색·선택·첫 기록으로 이어진 비율
- AI 콘텐츠에 대한 사람 댓글 수
- AI 콘텐츠 노출군과 비노출군의 D1 재방문 차이

AI 자체의 실행 세션·게시 수는 사람 이용자 수로 표시하지 않는다.

## 7. 게시 정책

- 초기에는 관리자 승인 후 게시한다.
- 작품당 동일 locale의 활성 질문은 1개만 유지한다.
- 같은 콘텐츠 hash는 중복 게시하지 않는다.
- 생성 실패·외부 모델 장애는 콘텐츠 게시 실패로만 처리하고 사용자 기록 흐름을 막지 않는다.
- 게시 콘텐츠에는 모델명보다 사용자에게 이해 가능한 `AI 운영 계정` 표시를 우선한다.
- 콘텐츠 원문, 프롬프트 버전, 사용한 작품 메타데이터를 감사용으로 남긴다.

## 8. 단계별 진행

### Slice 1: 데이터와 조회

- `system_actors`, `curated_contents` migration.
- 공개 콘텐츠 조회 모듈과 AI 표시가 포함된 DTO.
- 사람이 없는 공개 화면에서 큐레이터 섹션을 별도로 렌더.

### Slice 2: 결정적 콘텐츠 생성

- 모델 호출 전 템플릿 기반 질문 생성.
- 중복 hash와 locale별 활성 콘텐츠 제한.
- 관리자 초안 목록·게시·비활성화.

구현된 운영 경로:

- `GET /internal/admin/curated-contents` — 초안·공개·비활성화 목록
- `GET /internal/admin/curated-contents/titles?q=...` — 기존 작품 검색
- `POST /internal/admin/curated-contents/drafts` — 템플릿 또는 운영자 본문으로 초안 생성
- `POST /internal/admin/curated-contents/{id}/publish` — 승인 공개
- `POST /internal/admin/curated-contents/{id}/disable` — 즉시 비활성화
- 웹 관리자 화면: `/admin/curated-contents` (Cloudflare Access + BFF)

현재 템플릿 생성은 외부 모델을 호출하지 않는다. 작품 메타데이터와 언어만으로 질문을 만들고,
동일 작품·언어의 공개 질문은 하나만 허용한다. 운영 환경에서는 `ADMIN_CURATED_CONTENT_TOKEN`을
별도로 설정할 수 있으며, 미설정 시 기존 `ADMIN_ANALYTICS_TOKEN`을 호환 fallback으로 사용한다.

### Slice 3: 모델 adapter

- Gemini 또는 다른 LLM adapter 연결.
- `TextGenerator` fake를 이용한 통합 테스트.
- 생성 결과 안전성·길이·금칙 문구 검증.

### Slice 4: 사람 반응 측정

- `curated_impression`, `curated_open`, `curated_human_action` 수집.
- 기존 사람 지표와 분리된 관리자 카드.
- 최소 2주 관찰 후 유지 여부 판단.

## 9. 성공 기준

AI 게시물 수가 아니라 다음을 기준으로 판단한다.

- 공개 화면의 사람 섹션과 AI 섹션을 사용자가 구분한다.
- AI 콘텐츠가 사람의 첫 기록·댓글·재방문을 실제로 증가시킨다.
- 사람 이용자 지표가 AI 활동 때문에 변하지 않는다.
- AI 콘텐츠가 반복·스팸·허위 개인 경험으로 신고되지 않는다.
- 운영자가 한 번에 게시를 중단하고 콘텐츠를 비활성화할 수 있다.

## 10. 첫 구현 전 확인할 결정

1. v0 공개 위치를 `/public` 상단의 별도 섹션으로 할지, 제목 상세 내부 카드로만 할지.
2. 초기 게시를 템플릿 자동 생성으로 시작할지, LLM 초안 생성부터 시작할지.
3. 한국어만 먼저 할지, 한국어·영어를 동시에 할지.

기본 제안은 `/public` 별도 섹션 + 템플릿 기반 + 한국어 우선이다. 이 조합이 가장 작은 변경으로 신뢰·분석 오염을 통제하면서 효과를 검증할 수 있다.
