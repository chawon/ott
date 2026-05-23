# 페어링 코드 복구 카드

## 구현 상태

- `2026-05-23` production 반영 완료.
- PR: #36
- web deploy SHA: `b5b30af29731aae89ddc3bd336ad3752feddc666`
- production workflow: `Deploy Web to Production` run `26329158127`
- production manifest: `deploy/oke/web-deployment.yaml`의 `ott-web` image tag가 위 SHA로 업데이트됨

## 배경

- 페어링 코드는 가입 없이 같은 타임라인을 이어 쓰는 핵심 식별자다.
- CSV 내보내기는 기록 소유를 돕지만, 새 기기 연결에 필요한 페어링 코드 보관 문제는 별도로 남는다.
- 서버가 이메일을 발송하거나 코드를 원격 렌더링하면 무계정/프라이버시 방향이 흐려질 수 있다.

## 목표

1. 사용자가 현재 페어링 코드를 이미지로 저장해 개인 보관할 수 있게 한다.
2. 코드가 서버로 다시 전송되지 않도록 브라우저에서 로컬로 PNG를 생성한다.
3. 공개 공유가 아닌 개인 보관용임을 UI와 카드 문구에서 명확히 알린다.

## 범위

### 포함

- 설정 > 기기 연결의 페어링 코드 영역에 `복구 카드 저장` 액션 추가
- 로컬 Canvas 기반 PNG 생성
- 카드 안에 페어링 코드, 새 기기 입력 안내, 공유 금지 경고 표시
- 한국어/영어 문구 제공

### 제외

- 이메일 발송
- 서버 저장 또는 서버 이미지 렌더링
- QR 스캔 연결
- 코드 재발급/만료 정책 변경

## 구현 파일

- `apps/web/lib/recoveryCard.ts`
  - Canvas 기반 `1080x1440` PNG 생성
  - 카드 문구와 페어링 코드를 입력받아 브라우저에서만 렌더링
- `apps/web/app/[locale]/account/page.tsx`
  - 페어링 코드가 있는 경우에만 `복구 카드 저장` 액션 노출
  - `downloadBlob`으로 PNG 다운로드
- `apps/web/messages/ko.json`, `apps/web/messages/en.json`
  - 카드 본문, 경고, 저장 성공/실패 상태 문구

## 검증 시나리오

1. 페어링 코드가 있는 계정에서 복구 카드 PNG가 저장된다.
2. 페어링 코드가 아직 없을 때 저장 액션이 노출되지 않는다.
3. 생성 실패 시 설정 화면에 실패 상태가 표시된다.

## 검증 기록

- `npx tsc -p apps/web/tsconfig.json --noEmit --pretty false`
- `node_modules/@biomejs/cli-linux-arm64/biome check apps/web/lib/recoveryCard.ts apps/web/app/[locale]/account/page.tsx apps/web/messages/ko.json apps/web/messages/en.json docs/pairing-recovery-card.md`
- `git diff --check`
- `npm run build --workspace ott`

## 남은 정책 결정

`2026-05-23` 기준 실제 사용자 규모가 아직 작고 복구 카드 저장 UX가 먼저 반영되어, 페어링 코드 보안 정책 변경은 즉시 구현하지 않고 후속 안건으로 보류한다.

재검토 트리거:

1. 실제 사용자와 연결 기기 수가 늘어 코드 추측/공유 리스크가 커진다.
2. 복구 카드 저장 이후 코드 분실, 공유, 유출 관련 문의가 발생한다.
3. 앱 스토어, ChatGPT App, 외부 채널 심사에서 계정 연결 보안 정책 설명이 필요해진다.

추후 진행안:

1. 신규 발급 코드를 12자 이상으로 늘리고 `XXXX-XXXX-XXXX`처럼 표시만 그룹화한다.
2. `/api/auth/pair` 입력은 대소문자, 공백, 하이픈을 정규화한다.
3. `/api/auth/pair` 실패 시도에 rate limit과 감사 로그를 추가한다.
4. 설정에 코드 재발급을 추가하고, 재발급 시 기존 복구 카드는 무효화한다.
5. 신규 기기 연결 알림/승인 정책은 복구 가능성을 해치지 않는 범위에서 검토한다.
6. 장기적으로 페어링 코드와 복구 코드를 분리하고 서버 저장은 digest 기반으로 전환한다.
