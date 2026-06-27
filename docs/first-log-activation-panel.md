# First Log Activation Panel

## Context

최근 관리자 analytics 기준으로 방문자는 잡히지만 첫 기록까지의 전환이 낮다. 최근 30일 기준 방문자 대비 첫 기록 생성은 약 1.8% 수준이며, 다수 방문자는 `app_open`만 남기고 이탈한다.

이번 작업의 목표는 신규/무기록 사용자가 첫 화면에서 검색 의도를 직접 만들어야 하는 부담을 줄이고, 기존 기록하기 흐름으로 자연스럽게 진입하게 하는 것이다.

## Target Users

Activation 패널은 아래 조건을 모두 만족할 때만 노출한다.

1. 로컬 기록 수가 0개다.
2. 페어링 코드가 없다.
3. 현재 세션에서 패널을 닫지 않았다.
4. `quick=1`, 공유 진입, Android watch reminder 같은 강제 기록 진입이 아니다.

기존 사용자, 페어링 코드가 있는 사용자, 로컬 기록이 있는 사용자는 기존 홈/QuickLog 화면을 바로 본다.

## UX Direction

기본 선택은 영상이다. 다만 영상과 책은 같은 제품 축으로 보여주고, 이후 질문은 콘텐츠 성격에 맞게 다르게 둔다.

### Video

질문: "요즘 많이 남기는 작품 중 본 게 있나요?"

1. 실제 함께 기록된 작품을 우선 보여준다.
2. 부족한 칸은 `/api/titles/popular` 기반 인기 작품으로 채운다.
3. 포스터를 누르면 기존 QuickLog의 선택된 작품 화면으로 이동한다.
4. 저장은 자동으로 하지 않고 기존 `봤어요 / 보는 중 / 보고 싶어요` 상태 선택을 보여준다.

### Book

질문: "요즘 읽고 있는 책이 있나요?"

1. 먼저 `읽는 중 / 다 읽었어요 / 읽고 싶어요` 상태를 묻는다.
2. 선택한 상태는 이후 QuickLog 상태 화면에서 강조만 한다.
3. 책 모드 QuickLog 검색창에 포커스해 제목/저자 검색을 유도한다.
4. 저장은 자동으로 하지 않는다.

## Layout

### Mobile

신규/무기록 사용자의 첫 화면은 activation 패널을 우선한다. 패널은 화면 대부분을 차지해도 괜찮지만, `X` 닫기와 기존 기록하기 화면이 바로 이어진다는 신호는 명확해야 한다.

### Desktop

기존 홈의 레이아웃 안에서 QuickLog 위에 activation 패널을 보여준다. 영상 포스터는 그리드로, 책 상태 선택은 큼직한 버튼으로 배치한다.

## Analytics

성공 지표는 최종 `first_log_create`다. 중간 이벤트는 병목 확인용으로만 둔다.

1. `activation_impression`
2. `activation_dismiss`
3. `activation_content_type_select`
4. `activation_status_select`
5. `title_select` with source `activation_recent_discussion` or `activation_popular_title`
6. `log_create`
7. `first_log_create`

## Non-goals

1. iOS native 앱 포팅은 이번 범위에서 제외한다.
2. 책 베스트셀러/글로벌 인기 도서 provider chain은 이번 범위에서 제외한다.
3. 자동 저장, 자동 상태 적용, 추천 랭킹 기능은 만들지 않는다.

## Verification

1. 신규/무기록 조건에서 activation 패널이 보인다.
2. `X`로 닫으면 현재 세션 동안 다시 보이지 않는다.
3. 영상 포스터 선택 시 기존 QuickLog의 선택된 작품 상태 화면으로 이동한다.
4. 책 상태 선택 시 책 모드 검색창으로 이동하고, 선택한 상태는 저장 화면에서 강조된다.
5. 기록 저장은 기존 local-first, outbox, sync, `first_log_create` 흐름을 그대로 사용한다.
6. 모바일과 데스크톱에서 텍스트와 카드가 겹치지 않는다.
