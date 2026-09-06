# 인기 작품 큐레이션과 Telegram 승인

## 범위와 구현 방향

- 기존 `TmdbClient.availablePopular`를 재사용한다. 기본 한국어 후보는 기존 한국 콘텐츠 주간 트렌드 필터를 따른다.
- 매일 KST 09:30 이후 하루 최대 2개 초안을 생성한다. 미처리 초안은 최대 4개로 제한한다. 기존 초안/게시 작품과 최근 30일 처리 작품은 제외한다.
- 현재 생성기는 LLM이 아닌 `template-v1`이다. 새 외부 모델 도입 없이 ko/en 질문 변형을 제공하며 생성 출처를 남긴다.
- Telegram 메시지에 작품명, 포스터 미리보기, 공개할 전문과 게시/다시 생성/건너뛰기 버튼을 제공한다. 응답하지 않으면 초안으로 남는다.
- 공개 webhook 없이 Bot API `getUpdates`를 polling한다. 지정 chat ID와 승인자 user ID를 모두 확인한다. 관리자 토큰은 서버 내부에만 둔다.
- DB에 날짜별 생성 슬롯, Telegram message ID, 문구 버전, 수신 offset, 처리 감사 기록을 저장한다. PostgreSQL transaction advisory lock으로 여러 Pod의 중복 처리를 방지한다.
- 버튼은 초안 ID와 문구 버전에 묶는다. 재생성/관리자 변경 뒤 오래된 문구를 승인할 수 없어야 한다. 게시와 건너뛰기는 초안에만 적용한다.
- 버튼 처리 결과는 DB commit 이후에만 Telegram으로 응답한다. DB rollback 시 성공 안내도 보내지 않는다.
- Telegram 장애 시 DB 상태를 유지하고 재전송/메시지 갱신을 재시도한다. 외부 전송 성공 직후 DB commit 전에 종료되면 중복 메시지가 생길 수 있으나, 저장된 message ID가 일치하는 버튼만 처리한다.

## 변경과 검증

- 새 Flyway migration으로 자동화 상태와 감사 테이블을 추가한다. 기존 공개 API, 기록/댓글/동기화 계약은 유지한다.
- 기본 비활성화 상태로 구현한다. 배포 활성화 전 bot webhook/다른 polling 소비자가 없는지 확인하고 승인자 ID를 설정한다.
- PostgreSQL 통합 테스트: 일일 한도, 미처리 한도, 중복 후보, 미승인 비공개, 승인/재생성/건너뛰기, 다른 사용자/채팅/메시지 거부, 오래된 버튼, 재시작 offset, 전송 실패 재시도.
- Telegram HTTP 계약은 가짜 서버로 검증한다. 실제 운영 메시지와 게시 여부는 운영 활성화 후 별도 확인한다.

참고: [Telegram Bot API](https://core.telegram.org/bots/api#getupdates). 같은 bot에 webhook과 polling을 함께 사용할 수 없으며, callback은 `answerCallbackQuery`로 응답한다.

## 설정과 운영 활성화

| 환경변수 | 기본값 | 용도 |
|---|---|---|
| `CURATOR_AUTOMATION_ENABLED` | `false` | 생성·수신·전송 전체 활성화 |
| `CURATOR_TELEGRAM_APPROVER_USER_ID` | 없음 | 승인자 숫자 Telegram user ID. 활성화 시 필수 |
| `CURATOR_AUTOMATION_LOCALE` | `ko` | 게시 언어 `ko` 또는 `en` |
| `CURATOR_AUTOMATION_DAILY_LIMIT` | `2` | 하루 생성 한도, 최대 2 |
| `CURATOR_AUTOMATION_PENDING_LIMIT` | `4` | 승인 대기 한도, 최대 4 |

기존 `TELEGRAM_NOTIFY_ENABLED`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`,
`ADMIN_CURATED_CONTENT_TOKEN`(없으면 `ADMIN_ANALYTICS_TOKEN`)을 사용한다.
승인자 user ID는 chat ID와 별개이며, 특히 그룹 chat ID를 user ID로 넣으면 안 된다.
기본 스케줄은 10분마다 KST 09:30 이후 당일 부족분을 채운다. 재시작으로 누락된 당일 작업도 복구한다.
질문은 작품당 기본 1개와 변형 3개이며, 네 번째 문구 이후 재생성은 안내만 반환한다.
초안을 장기간 방치하면 최대 4개에서 신규 생성을 멈춘다. 기존 승인 메시지는 만료시키지 않는다.
건너뛴 작품은 최소 30일 제외되며, 동일 질문 hash가 남아 있으면 이후에도 같은 초안을 생성하지 않는다.

1. 배포 전 bot의 `getWebhookInfo`에서 URL이 비어 있는지 확인한다. 다른 `getUpdates` 소비자는 봇 단위로 중단하거나 별도 봇을 사용한다. 자동으로 webhook을 지우지 않는다.
2. 검증된 API 이미지 배포와 함께 활성화한다. 2026-09-06 운영 봇 수신지가 개인 채팅임을 확인했고, 사용자 승인에 따라 Deployment에서 `CURATOR_AUTOMATION_ENABLED=true` 및 기존 Secret의 `TELEGRAM_CHAT_ID`를 승인자 ID로 참조하도록 구성했다. 그룹 채팅으로 전환할 때는 별도 승인자 ID를 지정해야 한다.
3. Telegram에서 전문과 포스터 미리보기를 확인하고 게시한다. 포스터는 Telegram 링크 미리보기 정책에 따라 표시되지 않을 수 있다.
4. 원본 메시지의 `게시 완료`와 공개 `GET /api/curated-contents`(`Accept-Language: ko`)를 확인한다.
5. 중단은 `CURATOR_AUTOMATION_ENABLED=false`. 기존 공개 콘텐츠는 유지되며 필요한 항목은 관리자 화면에서 비활성화한다.

Telegram polling과 전송은 별도 scheduler를 사용한다. API 실패 로그에는 봇 토큰 URL이나 응답 원문을 남기지 않는다.
전송 실패는 5분 간격으로 재시도한다. 운영자가 승인 메시지를 Telegram에서 삭제하면 자동 복구되지 않으므로 원본을 유지한다.
bot/chat 변경은 기존 승인 message ID와 offset을 자동 이전하지 않으므로, 미처리 건을 먼저 정리하고 별도 이관해야 한다.

## 로컬 검증

`apps/api`에서 JDK 25로 `./gradlew test bootJar --no-daemon`을 실행한다.
자동화 통합 테스트는 Docker의 PostgreSQL 16을 사용하며, Docker가 없으면 전용 임시 DB를 가리키는
`CURATOR_TEST_JDBC_URL`과 `CURATOR_TEST_DB_USER`로 실행할 수 있다. 테스트는 해당 DB 데이터를 비우므로 운영/개발 공유 DB를 지정하면 안 된다.
루트 `npm run test`는 현재 package.json에 스크립트가 없어 실행할 수 없다.

2026-09-06 검증: JDK 25, 임시 PostgreSQL 16에서 신규 자동화/Telegram 테스트 15개 통과.
전체 API 테스트는 44개 통과, Docker 전용 기존 테스트 25개 생략, 실패 0개.
`bootJar` 성공 후 실제 JAR 부팅, Flyway v31, `/actuator/health`의 `UP`을 확인했다.
운영 배포, 실제 Telegram 전송·승인 버튼 처리, 공개 API 게시 결과까지 확인했다.

## 운영 배포 — 2026-09-06

- PR #105, 배포 SHA `6e89a1256188ae170d068540561b0008495df602`.
- 최종 PR API CI `34017700635`: 테스트·JAR·컨테이너 빌드 성공.
- API production run `34017827519`, manifest commit `afa902980eaee1343459b1fd9d8ad8a9c68860c6`.
- ArgoCD `ott-app` `Synced Healthy`, 운영 API image SHA와 `APP_VERSION=6e89a12`, health `UP`, Flyway v31 확인.
- 기존 Telegram 개인 채팅의 수신자 ID를 Secret 참조로 승인자에 연결했다. Bot webhook이 비어 있음을 확인했고, 토큰·ID 원문은 기록하지 않는다.
- KST 16:00 첫 자동 실행에서 `군체`, `들쥐` 초안 2개 생성. 두 항목 모두 Telegram message ID 및 `rendered_status=DRAFT`가 저장됐다. 승인 전 상태는 `DRAFT`다.
- KST 16:00:31 실제 승인자가 `들쥐`의 게시 버튼을 눌렀다. 감사 기록 `action=p`, 콘텐츠 `PUBLISHED`, 원본 Telegram 메시지 `rendered_status=PUBLISHED`를 확인했다.
- 운영 Web Pod의 공개 프록시 `/api/curated-contents`에서 HTTP 200과 게시된 `들쥐` 1건을 확인했다. 미승인 `군체`는 공개 응답에서 제외됐다.
- Web·iOS·Android 바이너리는 변경하거나 배포하지 않았다.
