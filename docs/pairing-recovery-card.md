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

- 페어링 코드 길이와 만료 여부
- 코드 재발급 시 기존 연결 유지/해제 규칙
- 신규 기기 연결 시 기존 기기 승인 또는 알림 필요 여부
