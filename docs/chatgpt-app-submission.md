# ottline ChatGPT App Submission Draft

## 1. Scope

- Submission target: `ottline`
- App type: read-only personal-history connector
- Current tool surface: `timeline.list_recent_logs`
- Auth model: OAuth + ottline pairing/recovery code
- Production MCP URL: `https://ottline.app/chatgpt/mcp`

## 2. Positioning

- ottline brings a user's recent watch history and notes into the conversation.
- ChatGPT interprets that history for summarization, comparison, and recommendation.
- The app does not create, edit, or delete records.
- The app becomes useful only when the connected ottline account already has recent logs.

## 3. Submission metadata draft

### App name

- `ottline`

### Category

- Primary: `Lifestyle`
- Alternate: `Productivity`

### Short description (KO)

- ottline 최근 기록을 ChatGPT에 연결해 내가 본 작품과 메모를 바탕으로 대화하세요.

### Full description (KO)

- ottline은 내가 최근에 본 영화, 시리즈, 책 기록을 ChatGPT 대화 안으로 가져오는 읽기 전용 앱입니다.
- 계정을 연결하면 최근 기록과 감상 메모를 ChatGPT가 읽을 수 있고, 그 데이터를 바탕으로 취향을 정리하거나 다음에 볼 작품을 제안받을 수 있습니다.
- ottline은 기록을 제공하고, 해석과 추천은 ChatGPT가 맡습니다.

### Short description (EN)

- Connect your recent ottline history to ChatGPT and talk about what you watched based on your own logs and notes.

### Full description (EN)

- ottline is a read-only ChatGPT app that brings your recent movie, series, and book logs into the conversation.
- After you connect your account, ChatGPT can read your recent logs and notes, then use that context to summarize your taste, compare recent watches, or suggest what to watch next.
- ottline supplies the history. ChatGPT handles the reasoning.

### Example prompts

- `Show my 10 most recent ottline logs.`
- `Show only the movies in my recent ottline history.`
- `Show only the series in my recent ottline history.`
- `What patterns do you see in my recent watch notes?`

## 4. Required URLs

- App docs: `https://ottline.app/chatgpt`
- Privacy policy: `https://ottline.app/privacy`
- Support email: `contact@ottline.app`
- MCP endpoint: `https://ottline.app/chatgpt/mcp`
- Domain verification URL: `https://ottline.app/.well-known/openai-apps-challenge`

## 5. Reviewer credentials

- The submission form must use the production values from:
  - `CHATGPT_REVIEW_USERNAME`
  - `CHATGPT_REVIEW_PASSWORD`
- Do not commit the actual reviewer username or password into this repository.
- These credentials should log the reviewer directly into a pre-seeded demo account with no sign-up and no 2FA.
- `CHATGPT_REVIEW_PAIRING_CODE` remains server-side only and should not be entered into the submission form.

## 6. Reviewer notes draft

- This app is a read-only connector for recent ottline history.
- The first protected tool call should trigger the OAuth connect flow.
- Reviewers can sign in with the provided review username and password and will be connected directly to a demo ottline account.
- No account creation, pairing code entry, or 2FA is required for the review path.
- The connected demo account should already contain recent logs across movies and series, with notes and context fields populated.

## 7. Positive test cases

### Test Case 1

- Scenario: Connect to the demo account and load recent watch history.
- User prompt: `Show my 10 most recent ottline logs.`
- Tool triggered: `timeline.list_recent_logs`
- Expected output: If not already connected, ChatGPT should prompt the reviewer to connect ottline. After signing in with the review credentials, the tool should return recent demo-account logs. The response should be read-only and include existing items only.

### Test Case 2

- Scenario: Filter recent history to movies only.
- User prompt: `Show only the movies in my recent ottline history.`
- Tool triggered: `timeline.list_recent_logs`
- Expected output: The tool should return only recent logs whose title type is `movie`. Series and books should be excluded.

### Test Case 3

- Scenario: Filter recent history to series only.
- User prompt: `Show only the series in my recent ottline history.`
- Tool triggered: `timeline.list_recent_logs`
- Expected output: The tool should return only recent logs whose title type is `series`. Movies and books should be excluded.

### Test Case 4

- Scenario: Sort by most recently updated history instead of watch date.
- User prompt: `Show the items I most recently updated in ottline, not just the ones I watched most recently.`
- Tool triggered: `timeline.list_recent_logs`
- Expected output: The tool should return recent logs ordered by history/update time rather than only watch date order.

### Test Case 5

- Scenario: Filter by viewing context.
- User prompt: `Show the titles I watched in theaters with family.`
- Tool triggered: `timeline.list_recent_logs`
- Expected output: The tool should return only logs matching the theater + family context from the demo account.

### Test Case 6

- Scenario: Filter by place only.
- User prompt: `Show the titles I watched in theaters.`
- Tool triggered: `timeline.list_recent_logs`
- Expected output: The tool should return only logs with theater as the viewing place.

## 8. Negative test cases

### Negative Test Case 1

- Scenario: General recommendation request with no need to read ottline history.
- User prompt: `Recommend five good sci-fi movies to watch this weekend.`
- Why the app should not trigger: This can be answered by ChatGPT without accessing the user's ottline history unless the user explicitly asks to use their ottline data.

### Negative Test Case 2

- Scenario: Public factual question unrelated to the user's ottline account.
- User prompt: `What is the plot of Parasite?`
- Why the app should not trigger: This is a general knowledge question and does not require private ottline history.

### Negative Test Case 3

- Scenario: User asks to create or modify data, which the app does not support.
- User prompt: `Add Dune to my ottline history and mark it as watched yesterday.`
- Why the app should not trigger: The app is read-only and cannot create, edit, or delete records.

## 9. Tool annotation justification

### `timeline.list_recent_logs`

- Read Only: `True`
  - The tool only reads existing watch-log data for the authenticated ottline user.
  - It resolves identity from the OAuth token and calls `GET /api/logs` with optional filters.
  - It does not call any create, update, delete, sync, or account-management endpoint.

- Open World: `False`
  - The tool does not browse the open web or access arbitrary URLs.
  - It is limited to ottline's own backend and returns only the signed-in user's stored history.

- Destructive: `False`
  - The tool cannot delete, overwrite, or modify data.
  - Its execution path is read-only end to end and only returns summarized existing records.

## 10. Screenshot plan

- Use widget screenshots, not prompt screenshots.
- Prefer connected state only.
- Recommended set:
  - `Recent logs`
  - `Movies only`
  - `Series only`
- Do not bake prompts, model responses, browser chrome, or explanatory overlays into the image.
- Use production-quality widget UI and export at the directory-required size.

## 11. Domain verification

- OpenAI domain verification should use the default base URL on `ottline.app`.
- The verification token is served from `/.well-known/openai-apps-challenge`.
- Production secret source: `OPENAI_APPS_CHALLENGE_TOKEN`
- If the token changes, production `web` must roll out again to pick up the new env value.

## 12. Pre-submission checklist

- `ottline.app/chatgpt` loads correctly in production
- MCP and OAuth metadata return `200`
- Domain verification URL returns the expected token
- Review credentials work immediately with no additional setup
- Demo account has enough recent logs and notes
- App description clearly states that the connector is read-only
- Submission examples and screenshots match the actual single-tool surface
