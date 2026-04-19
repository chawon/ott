# ottline ChatGPT App Submission Draft

## 1. 기준

- 제출 대상: `ottline`
- 제출 범위: ChatGPT read-only connector
- 현재 제품 포지션: `내 ottline 최근 기록을 ChatGPT 대화에 연결하는 앱`
- 현재 도구 표면: `timeline.list_recent_logs`
- 인증 방식: OAuth + ottline pairing/recovery code

## 2. 핵심 포지션

- ottline은 최근 기록과 메모를 제공한다.
- ChatGPT는 그 기록을 바탕으로 요약, 비교, 회상, 추천을 수행한다.
- ChatGPT 앱 안에서는 기록 생성, 수정, 삭제를 하지 않는다.
- 의미 있는 사용 경험을 위해 사용자의 `ottline.app` 계정에 최근 기록이 먼저 있어야 한다.

## 3. 제출 메타데이터 초안

### 앱 이름
- `ottline`

### 카테고리 후보
- Primary: `Lifestyle`
- Alternate: `Productivity`

메모:
- 기록 습관과 개인 회상 성격이 강해서 `Lifestyle`이 가장 무난하다.
- 생산성/개인 지식 정리 도구처럼 보이게 가져가려면 `Productivity`도 가능하다.

## 4. 한국어 초안

### 짧은 설명
- ottline 최근 기록을 ChatGPT에 연결해 내가 본 작품과 메모를 바탕으로 대화하세요.

### 상세 설명
- ottline은 내가 최근에 본 영화, 시리즈, 책 기록을 ChatGPT 대화 안으로 가져오는 읽기 전용 앱입니다.
- 계정을 연결하면 최근 기록과 감상 메모를 ChatGPT가 읽을 수 있고, 그 데이터를 바탕으로 취향을 정리하거나 다음에 볼 작품을 추천받을 수 있습니다.
- ottline은 기록을 제공하고, 해석과 추천은 ChatGPT가 맡습니다.

### 주요 가치
- 최근에 본 작품을 대화 안에서 바로 불러올 수 있음
- 감상 메모를 기반으로 취향 분석 가능
- 최근 영화/시리즈 기록만 따로 가져와 후속 질문 가능
- ChatGPT 안에서는 읽기 전용으로 안전하게 동작

### 예시 프롬프트
- 내가 최근에 본 영화 기준으로 다음에 뭘 보면 좋을까?
- 최근에 본 시리즈 기록만 보여주고 취향을 정리해줘.
- 내 최근 기록 메모를 바탕으로 어떤 장르를 자주 보는지 알려줘.

## 5. English Draft

### Short description
- Connect your recent ottline history to ChatGPT and talk about what you watched based on your own logs and notes.

### Full description
- ottline is a read-only ChatGPT app that brings your recent movie, series, and book logs into the conversation.
- After you connect your account, ChatGPT can read your recent logs and notes, then use that context to summarize your taste, compare recent watches, or recommend what to watch next.
- ottline supplies the history. ChatGPT handles the reasoning.

### Core value
- Load recent watches directly into the conversation
- Use your own notes as context for taste analysis
- Filter recent movies or series before asking follow-up questions
- Keep the ChatGPT app read-only and safe

### Example prompts
- Based on the movies I watched recently, what should I watch next?
- Show only my recent series logs and summarize my taste.
- What patterns do you see in my recent watch notes?

## 6. 필수 URL

- App docs: `https://ottline.app/chatgpt`
- Privacy policy: `https://ottline.app/privacy`
- Support email: `contact@ottline.app`
- MCP endpoint: `https://ottline.app/chatgpt/mcp`

## 7. 심사자 안내 초안

- 이 앱은 `최근 기록 조회`만 지원하는 읽기 전용 앱입니다.
- 보호된 도구를 처음 호출하면 OAuth 연결 화면이 열립니다.
- 사용자는 ottline `Settings / Account`에서 확인한 `pairing code` 또는 `recovery code`를 승인 화면에 입력해 연결합니다.
- 심사자용으로는 `review username/password`를 별도로 제공합니다.
- 연결 후에는 `timeline.list_recent_logs`만 사용됩니다.
- 계정에 최근 기록이 없으면 ChatGPT가 읽을 데이터가 거의 없으므로, 리뷰 계정에는 최근 기록과 메모를 미리 채워 두어야 합니다.

## 8. 심사 계정 준비물

- `CHATGPT_REVIEW_USERNAME`
- `CHATGPT_REVIEW_PASSWORD`
- `CHATGPT_REVIEW_PAIRING_CODE`
- 최근 기록이 충분히 있는 demo ottline 계정

권장 데이터:
- 최근 영화 5개 이상
- 최근 시리즈 5개 이상
- 메모가 포함된 기록 다수
- OTT, 장소, 함께 본 상황 값이 섞여 있는 데이터
- ottline.app에서 실제로 생성된 최신 기록

## 9. 심사용 테스트 시나리오

1. 앱을 연결하지 않은 상태에서 `내 최근 기록 보여줘`를 요청한다.
2. ChatGPT가 OAuth 연결 플로우를 여는지 확인한다.
3. 승인 화면에서 리뷰 계정 또는 `Settings / Account`의 pairing code로 연결한다.
4. `최근 기록 10개 보여줘`를 요청한다.
5. `최근 영화만 보여줘`를 요청한다.
6. `최근 시리즈만 보여줘`를 요청한다.
7. 불러온 기록을 바탕으로 `다음에 뭘 보면 좋을까?` 같은 후속 질문을 한다.

## 10. 제출 전 체크리스트

- `/chatgpt`, OAuth 승인 화면, widget이 `ko/en`으로 자연스럽게 보이는지 확인
- review 계정이 실제로 연결 가능한지 확인
- review 계정에 최근 기록과 메모가 충분한지 확인
- 제출 설명이 `검색 앱`이나 `추천 엔진`처럼 보이지 않게 정리
- 앱이 read-only라는 점을 메타데이터와 심사자 안내에 명확히 반영
