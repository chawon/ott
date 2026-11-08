# 미래의 타임라인

사용자가 남긴 완료 기록을 바탕으로 다음에 만날 이야기를 고르는 타임라인의 보조 기능이다. `2026-11-08` 사용자 승인으로 OpenAI 전환과 계정별 선택·하루 3회·기록 연결을 구현했다. 현재 상세 계약은 [계정별 추천 정책](future-timeline-account-policy.md), 최초 검토 근거는 [OpenAI 전환 검토](future-timeline-openai-review.md)를 따른다.

## 사용자 흐름

1. 타임라인의 ‘내 미래는?’에서 서버의 계정 제외와 남은 횟수를 읽는다.
2. 현재 한국 날짜에 해당 언어의 후보가 없고, 완료한 개인 LOG 기록이 5개 이상이면 첫 추천을 생성한다. 최근 3개월의 최대 50개를 우선하고 부족하면 전체 기간의 최근 완료 기록으로 보완한다.
3. 첫 생성 포함 **계정당 하루 3회** 성공한 생성만 허용한다. 모든 기기·언어가 횟수를 공유하고 한국 시간 자정에 초기화한다. 조회·카탈로그 확인·제외·되돌리기는 횟수를 쓰지 않는다.
4. ‘이미 본·읽은 작품’은 감상 기록과 별도로 서버에 저장한다. 연결된 기기에서 같은 선택을 읽으며 오프라인 선택은 계정별 대기열로 나중에 전송한다. 마지막 제외를 되돌릴 수 있다.
5. 실제 작품/책 판본을 확인해 기존 QuickLog의 ‘보고 싶어요·읽고 싶어요’로 이어진다. 작품을 고르기만 하면 기록하지 않는다. 사용자의 상태 버튼 클릭으로 기존 local-first/outbox 저장을 수행한다.
6. 새 기록은 기존 추천에서 즉시 숨긴다. 직접 저장과 outbox 저장 모두 그날의 후보를 유지하고, 새 느낌·메모는 다음 생성에 반영한다.
7. 새 추천은 6개를 목표로 먼저 최대 12개 후보를 받는다. 제외·중복 처리 후 부족하면 검토한 후보까지 피하도록 한 번 더 요청한다. 보충 포함 계정 횟수는 1회이며, 두 번 확인해도 부족하면 확보한 작품만 보여준다. 기존 배치 조회와 제외에는 자동 생성이 없다.

## API

활성 기기 `X-User-Id`, `X-Device-Id`와 `Accept-Language`를 사용한다. 개인 응답은 캐시하지 않는다.

- `GET /api/recommendations/state`: 읽기 전용 상태·후보·제외·횟수
- `POST /api/recommendations/generate`: `{requestId: UUID}`. `200` 완료/재사용, `202` 진행 중, `429` 3회 소진. 각 응답에 상태 본문 포함
- `GET|PUT /api/recommendations/exclusions`: 계정별 조회·멱등 저장
- `DELETE /api/recommendations/exclusions/{key}`: 멱등 복원
- `GET /api/recommendations/catalog?name=&type=&year=&author=`: 실제 카탈로그 확인
- 기존 배열 `GET /api/recommendations?refresh=&excluded=`: 호환 유지, 같은 서버 한도 적용

상태는 `items`, `exclusions`, `quota(date, timezone, limit, used, remaining, resetsAt)`, `generatedAt`, `generationId`, `generating`, `hasBatch`, `eligible`을 반환한다. 정상 빈 후보도 생성된 배치로 취급해 자동 요청이 반복되지 않는다. 제공자 실패/거절/불완전/잘못된 응답으로 유효 결과를 제공할 수 없으면 `503`이며 횟수와 기존 후보를 유지한다. 선택적 보충만 실패하고 첫 유효 결과를 제공하면 성공한 부분 결과 1회다. 완료 기록 부족은 제공자를 호출하거나 차감하지 않는다.

## 제공자·식별·저장

OpenAI 키가 있으면 Responses API + 엄격한 JSON Schema로 OpenAI만 호출한다. 기본 모델은 `gpt-6-luna`, 추론은 `low`다. 설정된 OpenAI가 실패해도 다른 유료 제공자를 자동 호출하지 않는다. OpenAI 미설정인 이전 설치는 기존 Anthropic/Gemini를 사용할 수 있다.

OpenAI 응답은 한 번에 최대 12개 후보·출력 토큰 6000으로 제한한다. 첫 결과가 부족할 때만 한 번 더 요청한다. 생성 ID별 단계 개수만 로그에 남겨 모델이 적게 준 경우와 제외로 줄어든 경우를 구분하며 제목·메모·키를 로그에 넣지 않는다.

영상은 종류·TMDB ID·원제·표시명·연도를 확인한다. 정확한 연도 우선, 개봉 기준 차이는 1년까지 허용하며 연도 없는 동명 작품을 대신 선택하지 않는다. 책은 실제 ISBN과 알려진 제목 별칭·원제·저자를 확인하고 판본은 사용자가 선택한다. 확인할 수 없는 이름이나 ID를 임의로 기록하지 않는다.

모든 기간의 개인 기록을 상태와 관계없이 제외한다. 댓글만 남긴 작품은 감상으로 간주하지 않는다. 이름은 NFKC·소문자·문장부호/공백 정규화 후 비교한다. 새로운 수동 제외는 종류와 식별자를 유지하므로 동명의 영화·책을 함께 숨기지 않는다. 예전 이름뿐인 로컬 제외는 한 번 서버로 옮겨 원래 의미를 보존한다.

V32의 계정 상태·언어별 후보·요청 시도·제외 테이블을 사용한다. DB 임대로 동시 생성을 합치고 같은 요청 ID의 재시도·새로고침·재시작이 추가 생성/차감을 만들지 않게 한다. 완료된 후보와 횟수는 함께 커밋하며 상태 조회는 짧은 읽기 스냅샷으로 일관성을 유지한다. LLM/카탈로그 호출 중 DB 트랜잭션을 유지하지 않는다. 기존 V22 캐시는 이번 전환에서 사용하지 않으며 원본을 삭제하지 않는다.

## 서버 환경변수

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-6-luna
OPENAI_REASONING_EFFORT=low
OPENAI_BASE_URL=https://api.openai.com

# 이전 설치 호환용
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

OpenAI 키는 API 프로세스에만 전달한다. 루트 `.env.local`은 Spring이 자동으로 읽는 파일이 아니므로 개발 실행 환경에서 필요한 값만 비공개 EnvironmentFile로 전달한다. 웹의 `NEXT_PUBLIC_*`·소스·정적 번들에는 넣지 않는다.

운영 반영 시 V32를 포함한 API가 먼저 필요하다. 이 작업의 개발 검증과 3000/ngrok 반영은 운영 배포를 뜻하지 않는다.

## OCI 운영 키 연결

기존 OTTLINE OCI Vault에 `OPENAI_API_KEY`라는 시크릿을 등록한다. 실제 값은 운영에서 사용할 OpenAI API 키다. `deploy/oke/openai-external-secret.yaml`이 기존 `oci-vault-store`를 통해 이를 읽어 Kubernetes `ott/ott-openai-secrets`의 `OPENAI_API_KEY`로 동기화하고, API Deployment가 같은 이름의 환경변수로 참조한다. 모델 `gpt-6-luna`와 추론 `low`는 비밀이 아니므로 Deployment의 일반 환경변수로 고정한다. 웹에는 키를 전달하지 않는다.

새 키가 아직 없더라도 DB 등 기존 시크릿의 동기화에 영향을 주지 않도록 별도 ExternalSecret과 선택적 API 참조를 사용한다. **OpenAI 전환 배포 전에는 이 선택적 참조와 별개로** `ott-openai-secrets`의 `Ready=True` / `SecretSynced`, Kubernetes 키의 존재·비어 있지 않음, 새 API Pod 주입을 값 출력 없이 반드시 확인한다. 개발 `.env.local`은 운영에 자동 전달되지 않는다.

키 저장만으로 실행 중인 Pod 환경변수가 바뀌지는 않는다. Vault 등록과 시크릿 동기화를 확인한 뒤, V32를 포함한 API를 배포·실제 추천을 확인하고 같은 병합 SHA의 웹을 배포한다.

`2026-11-08` 사용자의 Vault 생성 완료 후 기존 운영 Vault에서 `OPENAI_API_KEY`가 ACTIVE임을 확인했다. 운영 `oci-vault-store`와 준비한 설정이 같은 Vault를 가리키고 기존 대상 Secret이 없는 것을 확인한 뒤, 새 `ott-openai-secrets` ExternalSecret만 등록했다. `Ready=True` / `SecretSynced`, 키 존재·비어 있지 않음, 해당 운영 키의 OpenAI 인증과 `gpt-6-luna` 모델 조회 HTTP 200을 확인했다. 값은 출력하지 않았고 생성 요청은 보내지 않았다.

운영 API는 기존 `98417a9` 이미지로 ready 1개였고, 새 시크릿의 API 환경변수 참조와 v2 API/웹 이미지는 이 준비 단계에서 배포하지 않았다. 다음 운영 반영에는 준비한 Deployment 참조와 V32를 포함한 API가 먼저 필요하다.
