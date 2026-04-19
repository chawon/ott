# ottline ChatGPT App

## Overview

- Host surface: `apps/web`
- Auth surface: `apps/api`
- Public docs: `/chatgpt`
- MCP endpoint: `/chatgpt/mcp`
- Protected resource metadata: `/.well-known/oauth-protected-resource/chatgpt/mcp`
- OAuth authorization metadata: `/.well-known/oauth-authorization-server/chatgpt/oauth`
- OAuth endpoints: `/chatgpt/oauth/*` (rewritten to `apps/api`)

## Tool surface

- `timeline.list_recent_logs`

## Auth model

- Public auth uses OAuth 2.1 style authorization code + PKCE.
- End-user identity is still ottline pairing/recovery code based.
- Reviewers can use `CHATGPT_REVIEW_USERNAME` / `CHATGPT_REVIEW_PASSWORD`, which resolve to `CHATGPT_REVIEW_PAIRING_CODE`.
- Access tokens are signed bearer tokens shared between `apps/api` and `apps/web` via `CHATGPT_APP_SECRET`.
- Public scope is `timeline.read`.

## Required env

- `CHATGPT_APP_SECRET`
- `CHATGPT_OAUTH_ISSUER`
- `CHATGPT_RESOURCE_SERVER_URL`
- `CHATGPT_RESOURCE_DOCUMENTATION_URL`
- `CHATGPT_REVIEW_USERNAME`
- `CHATGPT_REVIEW_PASSWORD`
- `CHATGPT_REVIEW_PAIRING_CODE`

## Notes

- ChatGPT app v1 is a read-only recent-history connector. ottline supplies recent logs, and ChatGPT handles summarization, comparison, and recommendation in the conversation.
- ChatGPT app is read-only in v1: no log create/update, comment write, feedback write, device unlink, or account deletion.
- Private tools use OAuth bearer tokens.
- ChatGPT에서 의미 있는 결과를 보려면 사용자의 `ottline.app` 계정에 최근 기록이 먼저 있어야 한다.
- 사용자는 OAuth 승인 화면에서 `Settings / Account`에서 확인한 pairing code 또는 recovery code를 입력한다.
- The Next.js `X-Frame-Options` header is disabled only for `/chatgpt/*` so the widget can render inside ChatGPT.
- `/chatgpt`, the widget, and the OAuth authorize page resolve `ko/en` from `Accept-Language`.
