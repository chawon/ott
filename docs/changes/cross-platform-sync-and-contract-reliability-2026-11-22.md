# 멀티 기기 동기화·계정 안전성·큐레이터 종료 계약 복구 (변경안 초안)

> 상태: **기획 초안 (본부 우선순위·담당 검토 대기)** · 작성일: `2026-11-22` · 연결: [#158](https://github.com/chawon/ott/issues/158) · [#157](https://github.com/chawon/ott/issues/157)

## 사용자 문제와 완료 조건

### 현재 동작과 문제
`2026-11-22` 1차 플랫폼 감사([feature-matrix.md](../feature-matrix.md))에서 다중 기기 기록 동기화, 계정 삭제 안전성, 큐레이터 종료 계약과 직결된 4가지 클라이언트 결함이 확인됐다.

1. **Windows 동기화 Push 무음 누락 (`apps/windows-native`)**: `OttlineApiClient.PushSyncAsync`가 `POST /api/sync/push`에 `{ deviceId, mutations: [...] }`를 전송한다. 운영 API(`SyncController`/`SyncService`)는 `{ userId, deviceId, clientTime, changes: { titles, logs } }`를 기대하므로 `changes == null`로 모든 쓰기를 건너뛰고 `200 { accepted: [], rejected: [] }`를 반환한다. Windows 클라이언트는 누락된 `acceptedCount`를 `events.Count`로 대체 해석해 **outbox를 삭제하고 기록을 `synced`로 표시**한다. 결과적으로 Windows에서 작성·수정한 기록이 서버와 다른 기기로 전혀 올라가지 않는다.
2. **Windows `함께` 반응 계약 불일치 및 큐레이터 fallback 회귀 (`apps/windows-native`)**:
   - 반응 토글이 `POST /api/discussions/{id}/reactions` `{ reactionType }`를 호출하지만 운영 API는 `PUT /api/discussions/{id}/reactions` `{ type }`만 지원한다.
   - 운영 API `c693fd8`가 큐레이터 종료로 `GET /api/curated-contents`에 `200 []`를 반환하면, `MainViewModel.cs:2228-2237`이 하드코딩된 `DailyPromptPayload`로 fallback해 **종료된 큐레이터 질문 배너가 상시 노출**된다.
3. **Web/PWA `stale` 거절 시 outbox 잔류 (`apps/web`)**: `apps/web/lib/sync.ts:117-121,249-270`에서 서버가 `rejected: [{ id, reason: "stale" }]`를 반환하면 `pullChanges()`로 서버 최신값을 가져오지만, 거절된 outbox 항목을 제거·해소하지 않아 후속 동기화마다 큐 선두에서 반복 거절될 수 있다.
4. **Apple(iOS/iPadOS/macOS) 서버 계정 삭제 실패 UI 오류 (`apps/ios-native`, `apps/macos-native`)**: `OttlineRepository.deleteServerAccountAndLocalData()`는 API 실패 시 로컬 DB를 보존하지만, UI(`MySpaceScreen.swift:1389-1397`, `MacMySpaceAndDialogs.swift:631-636`)가 `try?`로 예외를 삼켜 실패해도 화면 상태를 비우고 `"서버 데이터를 모두 삭제했어요"` 성공 토스트를 표시한다. (기존 `2.0.1` 예정 업무인 큐레이터 dead UI/API 호출 제거 및 macOS `함께` 필터·정렬·반응 레이스 가드와 함께 점검한다.)

### 변경 후 기대 동작
- **Windows**: `POST /api/sync/push`가 공통 계약 `{ userId, deviceId, clientTime, changes: { titles, logs } }`를 전송하고 실제 `accepted`/`rejected` ID만 기준으로 outbox를 정리한다. 반응은 `PUT /api/discussions/{id}/reactions` `{ type }`와 `GET /reactions/me`를 사용한다. 큐레이터 API 호출·하드코딩 fallback·배너를 완전히 제거한다.
- **Web/PWA**: 서버 `stale` 거절 수신 시 `pullChanges()`로 서버 최신 상태를 반영한 뒤 해당 `stale` outbox 항목을 안전하게 해소(제거 또는 충돌 병합 완료 처리)해 후속 outbox 동기화가 막히지 않게 한다. (서버 성공 확인 전 로컬 기록 손실 금지, 네트워크/5xx 오류에는 기존 재시도 보존.)
- **iOS/iPadOS/macOS (`2.0.1`)**: 서버 계정 삭제 실패 시 `do/catch`로 예외를 처리해 로컬 데이터·UI 상태를 유지하고 실패 및 재시도 안내를 표시한다. 큐레이터 UI/API 호출을 제거하고 macOS `함께`에 종류 필터·정렬·반응 요청 레이스 가드 및 오류 안내를 보강한다.

### 동작 확인 시나리오와 완료 조건
1. **Windows ↔ 타 기기(Web/iOS/Android) 교차 동기화**: Windows에서 새 영상/책 기록 생성 및 수정 → 동기화 → 타 기기 pull에서 동일 기록·필드·수정 반영 확인; 서버 500/오프라인 시 outbox 보존 및 재연결 후 1회 반영(중복 없음).
2. **Windows `함께` 반응 & 큐레이터 부재**: `DONE`/`CURIOUS`/`SAVE` 토글 후 새로고침/타 기기에서 상태 일치; `함께` 화면에서 큐레이터 배너·요청 0건.
3. **Web `stale` 충돌 복구**: 기기 A·B에서 같은 기록 수정 → Web이 오래된 `baseUpdatedAt`으로 push → 서버 `stale` 거절 → Web이 최신 서버값 pull 후 해당 `stale` outbox 해소 → 직후 새 기록 B 생성 시 정상 push 완료.
4. **Apple 서버 계정 삭제 실패 보존**: 네트워크 차단 또는 모의 `500`/`401` 응답에서 삭제 실행 → 로컬 기록·연결 상태·화면 목록 유지 + 오류/재시도 안내 노출(성공 토스트 미노출); `200`/`204` 성공 시에만 로컬 초기화 및 성공 안내.

### 근거와 성공 지표
- **근거 기간/출처**: `2026-11-22` 1차 코드 감사([#157](https://github.com/chawon/ott/issues/157), `main` `8f6b751`).
- **대상 사용자**: Windows 네이티브 사용자, 다중 기기 Web/PWA 사용자, iOS/iPadOS/macOS 사용자.
- **성공 지표 (분자/분모)**:
  - **동기화 정상화**: Windows `POST /api/sync/push` 요청 중 `accepted > 0` 응답 비율 (현재: 구조적 `0%`, 목표: 정상 변경 요청의 오류 외 `100%`).
  - **충돌 복구**: Web `stale` 거절 발생 후 동일 클라이언트 후속 `outbox` 정상 동기화 성공률 (현재: `미측정` / 코드상 큐 블로킹, 목표: 회귀 테스트 `100%`).
  - **다중 기기 실사용**: 배포 후 완료된 14일 구간 내 2대 이상 기기에서 실제 동기화·기록한 계정 수 / 2대 이상 기기 등록 계정 수 (현재 기준선: `미측정`, `#158` 본부 요청 중, 관리자·테스트 제외).
- **연결 카드**: 기획 담당([#158](https://github.com/chawon/ott/issues/158)), 본부 상위 카드(검토 후 연결), 플랫폼별 실행 카드(Windows / Web / Apple 분리 배정).

---

## 공통 목표와 플랫폼 차이

- **관련 기능 기준표 항목**([feature-matrix.md](../feature-matrix.md)): `4. 동기화·오프라인`, `5. 함께 목록·상세·댓글·반응`, `6. 함께 큐레이터 종료`, `8. 삭제·초기화`.
- **공통 유지 결과**: 모든 전체 앱에서 로컬 우선 저장 → outbox → `POST /api/sync/push` / `GET /api/sync/pull` 계약 일치, `stale` 거절 시 최신 서버값 반영 후 큐 정상화, 서버 계정 삭제 실패 시 로컬 데이터와 UI 정직한 보존, 큐레이터 종료 완료.
- **제외 대상과 사유**:
  - **API**: 이미 `c693fd8`에 올바른 계약이 배포돼 있으므로 이번 변경에서 API 스키마/엔드포인트를 변경하지 않는다. (`LogController`의 `GET /api/logs/{id}/history` 인증 경계 및 `#155` 고아 기록 귀속은 API 담당 독립 검토로 분리.)
  - **Android**: `2.0.5 (29)`에 큐레이터 제거·동기화 계약이 이미 반영돼 심사 대기 중이므로 코드 변경 범위에서 제외(Play 공개·실기기 확인 및 `#149`는 기존 트랙 유지).
  - **확장·토스·ChatGPT**: 동기화 push·계정 삭제 UI 범위 밖(명시적 미지원/별도 채널 전략).
- **재검토 조건**: Windows `2.0.2.0`·Apple `2.0.1`·Web 배포 완료 후 14일간 다중 기기 실사용·오류 로그를 확인하고, Windows 나머지 기능 공백(시즌/에피소드 UI, 서버 이력, KDC, 추천 복구, 2단 함께)의 후속 범위를 재검토한다.

---

## 공통 계약

- **신규 API·DB 변경 없음**. 기존 [공통 API와 데이터 계약](../product-contracts.md)을 클라이언트가 준수하도록 정렬한다.
  - `POST /api/sync/push`: 요청 `{ userId, deviceId, clientTime, changes: { titles, logs } }`, 응답 `{ accepted, rejected }`.
  - `PUT /api/discussions/{id}/reactions`: 요청 `{ type: "DONE" | "CURIOUS" | "SAVE" }`, 조회 `GET /api/discussions/{id}/reactions/me`.
  - `GET /api/curated-contents`: 종료(`200 []`), 신규 클라이언트에서 호출하지 않음.
  - `DELETE /api/auth/account`: 2xx 확인 후에만 로컬 초기화 및 성공 안내.
- **기존 데이터·이전 설치판 호환**:
  - Windows 기존 설치판의 로컬 SQLite `logs` 중 `sync_status = "synced"`로 오표기됐지만 서버에 없는 기록이 있을 수 있다. **중요 호환 고려**: 업그레이드 후 첫 동기화에서 서버 `pull` 결과와 로컬 `logs`를 대조해 서버에 없는 로컬 미반영 기록을 1회 재적재(re-enqueue)할지 Windows 담당 기술 설계에서 반드시 검토한다(중복 방지·기존 `titleId`/`id` 매핑 확인 필수).
  - Web `stale` 해소는 서버 `rejected` 사유가 `stale`인 경우에만 해당 outbox 항목을 제거하며, `5xx`/네트워크 실패·`401` 등 일시 오류 항목은 기존처럼 보존·재시도한다.
- **검토한 대안**:
  - *대안 A (API가 Windows의 `mutations` 포맷을 추가 수용)*: 기각. 공통 sync 계약을 이중화해 유지보수 위험을 키우고, Windows의 `CREATE_DISCUSSION`/`TOGGLE_REACTION` 혼합 큐까지 서버에 떠넘기게 됨.
  - *대안 B (추천 — 클라이언트를 공통 API 계약으로 통일)*: 채택. Android·Apple·Web이 이미 검증한 단일 `SyncPushRequest` 계약을 유지하며 API·DB 위험이 0이다.

---

## 플랫폼별 반영

| 대상 | 변경과 소스 경로 | 검증 조건 | 상태와 근거 |
| --- | --- | --- | --- |
| API | 변경 없음 (`c693fd8` 기준 계약 유지). `#155` 및 `history` 인증 경계는 별도 트랙. | 기존 `Verify API` 계약 유지 | 운영 확인 (`c693fd8`) |
| Web/PWA | `apps/web/lib/sync.ts`, `apps/web/lib/sync.test.mjs` (`stale` 거절 시 `pullChanges()` 후 해당 outbox 항목 해소 및 후속 큐 진행). 선택 소규모 정리: `apps/web/lib/analytics.ts` iPadOS `osFamily` 보정. | 단위 테스트(`sync.test.mjs`에 `stale` 후속 push 성공 케이스 추가), Next production build, `Verify Web` CI, 운영 배포 + 설치형 PWA 확인 | 대기 (초안) |
| Android | 변경 없음 (`2.0.5 (29)` Play 심사 대기·`#149` 별도) | 기존 `2.0.5` Play 공개·실기기 검증 유지 | 해당 없음 |
| iPhone · iPad | `apps/ios-native/.../MySpaceScreen.swift`(삭제 `do/catch` 오류 안내), `apps/apple-core/.../OttlineApiClient.swift` & `TogetherScreen.swift`(큐레이터 제거 + 함께 로드 오류 UI). `2.0.1` 묶음. | `OttlineTests` 실패 보존 단위 테스트, `Native iOS v2 CI`, 실기기 오류/성공 테스트, App Store `2.0.1` | 대기 (초안 · 기존 `2.0.1` 카드 연계) |
| macOS | `apps/macos-native/.../MacMySpaceAndDialogs.swift`(삭제 `do/catch` 오류 안내), `MacTimelineAndTogetherViews.swift`(큐레이터 제거 + 종류 필터·정렬·반응 레이스 가드·오류 UI). `2.0.1` 묶음. | `OttlineMacTests`, `Native macOS v2 CI`, App Sandbox 실기기 확인, Mac App Store `2.0.1` | 대기 (초안 · 기존 `2.0.1` 카드 연계) |
| Windows | `apps/windows-native/src/Ottline.Core/Remote/OttlineApiClient.cs` & `OttlineRepository.cs` (`POST /api/sync/push` `changes` 계약 일치 + `accepted`/`rejected` 기반 outbox 정리 + 미반영 로컬 기록 복구 검토; `PUT /reactions` & `GET /reactions/me`), `MainViewModel.cs` & `MainWindow.xaml` (큐레이터 fallback·배너·API 호출 제거), `UA`/`windowsAppVersion` 동적 버전 반영. `2.0.2.0` 대상. | `Ottline.Tests` 모의 API 계약 테스트(`push` body 스키마·`accepted`/`rejected`·`PUT /reactions`·큐레이터 0호출), `Native Windows CI`, MS Store `2.0.2.0` 게시 후 Windows↔모바일/웹 실기기 교차 동기화 | 대기 (초안 · `2.0.1.0` 심사 이후 즉시 착수) |
| 확장 · 토스 · ChatGPT | 변경 없음 (범위 밖) | 기존 채널 전략 유지 | 명시적 제외 |

---

## 출시와 복구

- **선행 변경과 적용 순서**: API 선행 배포 불필요(`c693fd8`에 이미 계약 존재). Web/PWA, Apple `2.0.1`, Windows `2.0.2.0`(현재 심사 중인 `2.0.1.0` 완료 후 또는 통합)을 각 플랫폼 CI·스토어 절차에 따라 **병렬 착수·독립 출시**할 수 있다.
- **기존 데이터 보존**: 로컬 기록 삭제 없음. Windows는 업그레이드 전 `synced`로 오표기됐을 수 있는 로컬 기록의 안전한 1회 재동기화(중복 생성 방지)를 기술 설계 단계에서 검증한다.
- **되돌리는 조건과 방법**:
  - Web: 동기화 오류율 급증 또는 outbox 유실 징후 시 이전 검증 Web 이미지(`c693fd8`)로 즉시 롤백.
  - Apple/Windows: 스토어 배포 전 TestFlight / 사이드로드 설치판에서 회귀 확인 후 제출; 이상 발견 시 제출 중단 및 수정 빌드 재제출.

---

## 출시 후 개선 판단

- **확인 구간**: 각 플랫폼 공개 배포 완료 시점 기준 **14일(완료된 KST 달력일)** 관찰. 운영자·테스트 계정 제외, API/Web 배포와 네이티브 스토어 공개 시점을 분리해 집계.
- **유지·추가 개선·되돌림 기준**:
  - Windows `sync/push` 정상 반영 및 교차 기기 동기화 실기기 확인, Web `stale` 충돌 해소, Apple 삭제 실패 보존, 전 플랫폼 큐레이터 완전 종료가 모두 확인되면 **1순위 완료**로 판정하고 **2순위(월간 포스터 달력 + 회상 카드)** 착수로 전환.
  - Windows 기존 로컬 오표기 기록의 재동기화에서 중복 생성이나 오류 급증이 발견되면 재적재 트리거만 비활성화하고 핫픽스 진행.
