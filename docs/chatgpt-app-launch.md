# ottline ChatGPT App

## Current scope

- Product position: a read-only connector that brings a user's recent ottline history into ChatGPT.
- v1 tool surface: `timeline.list_recent_logs`
- Supported data: recent movie, series, and book logs that already exist in the user's ottline account.
- Non-goals in v1: create/update/delete, recommendations inside ottline, public search, community features, or account management.
- Role split: ottline supplies recent history and notes; ChatGPT handles summarization, comparison, and recommendation in the conversation.
- Review status: OpenAI app submission is in review as of `2026-04-23`.

## Public surface

- App docs: `https://ottline.app/chatgpt`
- MCP endpoint: `https://ottline.app/chatgpt/mcp`
- Protected resource metadata: `https://ottline.app/.well-known/oauth-protected-resource/chatgpt/mcp`
- OAuth authorization server metadata: `https://ottline.app/.well-known/oauth-authorization-server/chatgpt/oauth`
- OAuth endpoints: `https://ottline.app/chatgpt/oauth/*`
- Domain verification: `https://ottline.app/.well-known/openai-apps-challenge`

## Auth model

- Public auth flow: OAuth authorization code + PKCE
- Public scope: `timeline.read`
- End-user identity source: ottline pairing code or recovery code entered on the OAuth authorize page
- Reviewer shortcut: `CHATGPT_REVIEW_USERNAME` / `CHATGPT_REVIEW_PASSWORD` map server-side to `CHATGPT_REVIEW_PAIRING_CODE`
- Access tokens are signed bearer tokens shared between `apps/api` and `apps/web` through `CHATGPT_APP_SECRET`

## Required env

- `CHATGPT_APP_SECRET`
- `CHATGPT_OAUTH_ISSUER`
- `CHATGPT_RESOURCE_SERVER_URL`
- `CHATGPT_RESOURCE_DOCUMENTATION_URL`
- `CHATGPT_REVIEW_USERNAME`
- `CHATGPT_REVIEW_PASSWORD`
- `CHATGPT_REVIEW_PAIRING_CODE`
- `OPENAI_APPS_CHALLENGE_TOKEN`

## Deployment notes

- OpenAI registration, domain verification, and reviewer testing must use `ottline.app`.
- `staging.ottline.app` is behind Cloudflare Access, so it is not suitable for OpenAI registration or review flows.
- The domain verification token is served by `apps/web` from `OPENAI_APPS_CHALLENGE_TOKEN`, so changing that value requires the production `web` pod to roll out again.
- The secret mapping for production is managed in `deploy/oke/external-secret.yaml`.

## User experience notes

- Meaningful results require the user to already have recent logs in `ottline.app`.
- The OAuth authorize page tells users to find their pairing code or recovery code in `Settings / Account`.
- `/chatgpt`, the widget, and the OAuth authorize page resolve `ko/en` from `Accept-Language`.
- The Next.js `X-Frame-Options` header is disabled only for `/chatgpt/*` so the widget can render inside ChatGPT.

## Verification checklist

- `GET /chatgpt` returns `200`
- `GET /.well-known/oauth-protected-resource/chatgpt/mcp` returns `200`
- `GET /.well-known/oauth-authorization-server/chatgpt/oauth` returns `200`
- `GET /.well-known/openai-apps-challenge` returns the configured token when `OPENAI_APPS_CHALLENGE_TOKEN` is set
- Protected tool calls prompt OAuth and succeed after connecting with a valid ottline account or review credentials
