# 미래의 타임라인

사용자가 남긴 영상·책 기록에서 다음에 만날 작품을 고르는 기능이다. 2026-11-08 v2 운영 배포부터 OpenAI와 서버 계정 기반 제외·횟수 정책을 사용한다.

## 화면과 기록 연결

타임라인의 ‘나의 미래는?’ 또는 개인화된 진입 버튼으로 연다. 저장된 결과를 읽는 것은 무료이며 새 추천은 생성 버튼을 눌러 요청한다. 버튼 앞에서 OpenAI로 보내는 항목과 개인정보처리방침을 안내한다.

카드는 작품·종류·장르·추천 이유를 보여준다. 이미 본·읽은 작품은 제외하고 되돌릴 수 있다. 영상은 확인한 카탈로그 작품으로, 책은 판본을 고른 뒤 기록창으로 이어진다. 상태가 미리 선택돼도 하단 기록 버튼을 직접 눌러야 저장한다.

## 서버 정책

| 항목 | 동작 |
| --- | --- |
| 최소 기록 | 대상 기록 5개 이상 |
| 이력 | 최근 3개월 최대 50개, 부족하면 감상한 기록으로 보충 |
| 생성 | 한국 시간 기준 계정 전체에서 성공 3회/일, 첫 생성 포함 |
| 읽기·제외·되돌리기 | 생성 횟수 차감 없음 |
| 실패 | 성공 횟수를 차감하지 않으며 기존 결과 보존 |
| 여러 기기 | 제외·되돌리기·사용 횟수 공유, 언어별 결과 보관 |
| 재시도 | 요청 UUID와 서버 임대로 중복 생성·차감 방지 |
| 계정 정리 | 연결 계정 합치기와 서버 데이터 전체 삭제에 포함 |

OpenAI `gpt-6-luna`, reasoning effort `low`를 사용하며 키는 OCI Vault → 별도 ExternalSecret → API 환경변수로 전달한다. 다른 provider 구현은 호환을 위해 남아 있지만 OpenAI가 설정되면 우선한다.

최종 후보는 6개를 목표로 한다. 첫 후보군 12개에서 실제 카탈로그·기록·제외를 확인하고 필요하면 한 번 더 보충한다. 같은 생성의 보충은 추가 횟수를 차감하지 않는다. 새 기록은 기존 후보에서 바로 제외하며 취향 변경은 다음 생성에 반영한다.

## API와 저장

- `GET /api/recommendations/state`: 결과·제외·KST 횟수·진행 상태 조회.
- `POST /api/recommendations/generate`: 요청 UUID로 생성, 진행 중 202·하루 제한 429.
- `GET|PUT /api/recommendations/exclusions`, `DELETE /api/recommendations/exclusions/{key}`: 계정별 제외·되돌리기.
- `GET /api/recommendations/catalog`: 종류·연도·저자·판본을 확인하는 읽기 전용 검색.
- 기존 배열형 `GET /api/recommendations` 계약은 유지한다.

V32의 `recommendation_account_state`, `recommendation_batches`, `recommendation_generation_attempts`, `recommendation_exclusions`를 사용한다. 기록·제목 테이블은 마이그레이션에서 변경하지 않는다.

## 운영 검증

배포 SHA `b9f88a6`에서 실제 OpenAI 추천 6개 → 제외 후 5개 → 새 추천 6개와 기기 간 공유를 확인했다. 성공 3회 뒤 네 번째 요청은 429이며 동일 UUID 재시도와 제외 되돌리기는 추가 차감하지 않았다. 테스트 계정과 추천 데이터는 정리했다.

- [정책·동시성·카탈로그 계약](../../../docs/future-timeline-account-policy.md)
- [운영 배포·백업·검증](../../../docs/ottline-v2-production-rollout.md)
- [OpenAI 전환 검토](../../../docs/future-timeline-openai-review.md)

구현: `apps/api/src/main/java/com/watchlog/api/llm`, `service/RecommendationAccountStore.java`, `RecommendationService.java`, `RecommendationCatalogService.java`, `apps/web/lib/useRecommendations.ts`, `recommendations.ts`, `app/[locale]/timeline/page.tsx`.

관련: [[ottline-v2]], [[timeline]], [[book-log]], [[share-card]].
