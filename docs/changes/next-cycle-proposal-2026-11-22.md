# 다음 개선 사이클 우선순위 제안서 (2026-11)

- 11월 24일에 제안 순서를 확정했다. 11월 28일 본부가 데이터 안전성 검증과 달력 착수 조건을 갱신했다. [본부 #158](https://github.com/chawon/ott/issues/158#issuecomment-7183368172)
- **기준 소스 / 운영 반영**: `main` [`81b0a0c`](https://github.com/chawon/ott/commit/81b0a0c) · Web·API 통합 운영 반영 [`c693fd8`](../web-api-rollout-2026-11-22.md) · [플랫폼 현황](../platforms.md)
- **작성 역할**: 제품 기획 담당 ([이슈 #158](https://github.com/chawon/ott/issues/158))
- **입력 근거**: [#157 플랫폼별 1차 감사](../feature-matrix.md) · [#159 경쟁·인접 제품 리서치](../research/competitor-landscape-2026-11.md) · 본부 사용 근거 4종 회신([#158 사용 근거](https://github.com/chawon/ott/issues/158#issuecomment-7077018738)) · [#169 공통 계측 정합성 검증](https://github.com/chawon/ott/issues/169) · [#176 월간 달력 확정 정책](https://github.com/chawon/ott/issues/176#issuecomment-7123200833) · [통계 집계 기준](../realistic-analytics-metrics.md) · [마케팅 운영](../marketing-operations.md)

> **승인·상태 구분**: `2026-11-24` 사용자(제품 오너) 방향 확인 및 본부 재검토로 **1순위: 데이터 안전성 복구(`#161`·`#171`·`#162`·`#163`) → 2순위: 월간 달력([#176](https://github.com/chawon/ott/issues/176)) → 3순위: QR 페어링([#165](https://github.com/chawon/ott/issues/165), `#169` 계측 연계)** 순서를 확정하고, **외부 기록 가져오기([#164](https://github.com/chawon/ott/issues/164))는 후순위(보류)**로 조정했다. 2·3순위는 검증할 기획 후보 상태이며, 구현·출시 승인은 각 선행 조건과 본부 검토를 거쳐 별도 결정한다.

---

## 1. 본부 회신 사용 근거 4종 현황과 수집 한계

본부가 요청 근거 4종을 조회해 세부 수치와 플랫폼별 표는 **비공개 주간 사용 통계**에 기록했고(11월 23일 완료 주간 두 개 추가 비교 포함), 공개 문서·이슈에는 **집계 완료 여부·기간·정의·해석 주의·실제 미측정 항목**만 반영한다(원문·수치·계정/기기 식별자 비공개 원칙 유지).

| 관찰 흐름 | 기준선 상태 (`2026-11-24`) | 확인 기간·정의 | 해석 주의 및 수집 한계 |
| --- | --- | --- | --- |
| **1. 첫 기록·행동 도달** | **집계 완료 (수치 비공개)** | 완료 7일 `[2026-11-15, 2026-11-22)` · 30일 `[2026-10-23, 2026-11-22)` KST, 공식 `AnalyticsMetricsQuery` 기준. 운영자·연결 익명 활동 제외(특정 Android 신호는 테스트 미확정으로 기본·제외 참고치 분리). | **`first_log_create` actor 수는 서버 보존 기준 첫 직접 기록 계정과 같지 않음.** 익명 귀속·로컬 미동기화·기기별 의미 확인(`#169`) 전 실제 신규 사용자 수나 전환율로 직해석 금지. 또한 11월 22일 Apple `2.0.0` 공개 및 11월 24일 Apple `2.0.1`·Android `2.0.5` 공개 이후 효과를 나타내는 구간이 아님. |
| **2. 완료 주간 반복 기록** | **집계 완료 (수치 비공개)** | 완료 월~일 4주 `[2026-10-19, 2026-11-16)` 및 11월 23일 추가 완료 주간 비교. 신규 서버 기록과 실제 상태가 달라진 수정 이력 분리, 첫 기록 코호트의 다음 주 활동 확인. | **표본이 작음.** 최근 코호트의 다음 주는 아직 완료되지 않아 미성숙 상태이며, 분모 0·미성숙 구간을 유지율 `0%`로 해석하지 않음. 미동기화 로컬 전용 기록 제외 한계. |
| **3. 연결과 다중 기기 실사용** | **등록 분포만 집계 완료 (비공개) / 기간 내 2대 이상 실사용 비율·전체 연결 성공률은 여전히 실제 미측정** | 현재 등록 분포 확인, 자동 이어받기와 가입(`register`) 구분. | 등록 수는 물리 기기 수나 실사용량이 아님. 서버 기록/이력의 작성 기기와 analytics client를 일관 귀속할 자료가 없어 **2대 이상 실사용 비율은 미측정**. 코드 연결 성공이 보관 이벤트에 없다는 사실로 실제 사용 `0회` 단정 금지. 연결 시도·실패 분모 공통 미수집으로 전체 성공률 산출 불가 → **[`#169`](https://github.com/chawon/ott/issues/169) 선행 검증 대상**. |
| **4. 문의 유형** | **집계 완료 (수치 비공개)** | 같은 30일 구간 `BUG`/`IDEA`/`QUESTION`/`OTHER` 및 응답 상태 집계. | 사용자 선택 분류이므로 검증된 장애 원인이나 일반 고객 수로 단정 금지. 의심 기기 그룹 문의도 자동 테스트 미확정으로 임의 미삭제. |

### 11월 24일 기획 제안 당시의 공개판과 심사·후보 버전

| 플랫폼 | 현재 사용자에게 공개된 버전 | 심사 제출 / 차기 후보 (미공개) | 남은 실사용·운영 확인 |
| --- | --- | --- | --- |
| **공통 API · Web/PWA** | 운영 `c693fd8` (`11-22` 배포) | Web [`#162`](https://github.com/chawon/ott/issues/162#issuecomment-7122976697)(PR `#178`·CI 검증 뒤 운영 확인 잔여) · API [`#171`](https://github.com/chawon/ott/issues/171)(프로젝트판 **대기**) · API `#155` | 설치형 PWA, Mac 설치판 연결, `#162` 운영 확인 |
| **iOS · iPadOS · macOS** | **`2.0.1` 공개** (`11-24` KST — Mac 06:09, iPhone·iPad 08:25, [PR #173](https://github.com/chawon/ott/pull/173), `#163` 삭제 실패 처리·큐레이터 제거·iPad 2단·macOS 필터/정렬·위젯 3종 반영; 최초 `2.0.0`은 `11-22` 공개) | — | 공개 `2.0.1` 실기기 검증([#163 댓글](https://github.com/chawon/ott/issues/163#issuecomment-7119018051)) |
| **Windows** | **`2.0.1.0` 공개** (한·미 MS Store, arm64 설치판 계정 삭제 성공/오프라인 실패 보존 검증 완료) | **`2.0.2.0` 심사 제출 중(`Certification`)**(PR `#156`+`#168`, `59/59` 통과, Submission `1152921505702478292`) · **`2.0.3.0` 후보**(PR `#172` 구버전 ID 삭제 재검증 및 후속 보완 중, [API #171](https://github.com/chawon/ott/issues/171) 대기) | `2.0.2.0` 공개 후 교차 동기화, `2.0.3.0` 제출·확인 |
| **Android** | **`2.0.5` 공개 확인** (`11-24` 본부가 [한국 Play](https://play.google.com/store/apps/details?id=app.ottline&hl=ko&gl=KR)·[미국 Play](https://play.google.com/store/apps/details?id=app.ottline&hl=en&gl=US) 공개 버전 필드에서 `2.0.5` 확인, PR `#146`·`#148` 포함) | 후속 [#149](https://github.com/chawon/ott/issues/149) · [PR #154](https://github.com/chawon/ott/pull/154) 별도 진행 | 태블릿 실기기 확인, `#149`·PR `#154` 검증 |

---

## 2. 기존 진행 업무 및 신규 접수 업무 경계

| 업무 | 추적 위치 | 이번 제안과의 경계 |
| --- | --- | --- |
| 공통 데이터 안전성 복구 (최우선) | 공개 설치판 검증 중인 [Windows #161](https://github.com/chawon/ott/issues/161)·[Apple #163](https://github.com/chawon/ott/issues/163). 운영 검증을 마친 [API #171](https://github.com/chawon/ott/issues/171)·[Web #162](https://github.com/chawon/ott/issues/162)·[API 및 설치 PWA #182](api-active-log-lists-182-2026-11-26.md) | Windows와 Apple의 남은 인수 결과로 달력 착수를 판단한다. [본부 #158](https://github.com/chawon/ott/issues/158#issuecomment-7183368172) |
| 공통 계측 정합성 검증 (측정 기반) | [#169](https://github.com/chawon/ott/issues/169) (API 담당 조율 · 공통 · 보통 · 대기) | 첫 기록·기기 연결·다중 기기 실사용 정의와 귀속 검증. **2순위 달력 계측 정합 및 3순위 QR 페어링(`#165`) 효과 측정의 선행 기반** |
| 월간 달력 기술 검토 (2순위 선행) | [#179](https://github.com/chawon/ott/issues/179)(API 과거 월 조회·계측 검토) · [#180](https://github.com/chawon/ott/issues/180)(Web/PWA 부분 캐시·회상 동작 검토) | 11월 25일 두 기술 검토 완료. 구현 착수 판단은 [#158](https://github.com/chawon/ott/issues/158)에서 추적 |
| 기존 독립 트랙 | [#142](https://github.com/chawon/ott/issues/142) · [#147](https://github.com/chawon/ott/issues/147) · [#149](https://github.com/chawon/ott/issues/149) · [#155](https://github.com/chawon/ott/issues/155) · 본부 비공개 API 이력 권한 검증 | 각 독립 트랙 유지 (중복 등록 금지) |
| 후속 기획 설계 3건 | **2순위**: [#176 월간 달력](https://github.com/chawon/ott/issues/176) / **3순위**: [#165 QR 기기 연결](qr-device-pairing-2026-11-22.md) / **후순위(보류)**: [#164 외부 기록 가져오기](external-record-import-2026-11-22.md) | 기획 초안 상태, 구현·출시는 별도 승인 단계 |

---

## 3. 확정 우선순위 (안전성 복구 → 월간 달력 → QR 페어링)

본부 회신의 수집 한계(반복 기록 소표본·미성숙, 다중 기기 실사용·연결 성공률 미측정)와 `2026-11-24` 사용자 방향 판단(현재 해외 이용자가 매우 적어 해외 포맷 Import보다 국내·전체 사용자가 즉시 체감하는 회상·QR 연결이 우선)을 반영한 최종 우선순위다.

### 1순위 데이터 안전성 복구

- **11월 28일 본부 확인**
  - Apple `2.0.1 (28)`은 공개됐다. iPhone·iPad·Mac에서 테스트 계정으로 삭제를 시도해 오프라인 실패 시 기록·연결·입력과 재시도 안내가 남고, 온라인 재시도 성공 후에만 초기화되는지 확인한다. [Apple #163](https://github.com/chawon/ott/issues/163#issuecomment-7119018051)
  - Web #162를 `8c8b064`로 배포했다. 기존 설치 PWA에서 실제 서버 충돌 뒤 후속 기록이 한 번 전송됐고, 재시작 후 대기열이 비었다. [운영 인수 완료](https://github.com/chawon/ott/issues/162#issuecomment-7162996402)
  - Windows `2.0.3.0`이 한국·미국 스토어에 공개됐고 본부 ARM64 기기에서도 기존 설치판 업데이트를 확인했다. 남은 조건은 기존 기록·이력 보존과 새 감상이 모바일·웹에 한 번씩 반영되는지 확인하는 것이다. [스토어 근거](../../wiki/pages/platforms/ms-store.md) · [Windows #161](https://github.com/chawon/ott/issues/161#issuecomment-7181905935)
  - API #171에서 페어링 기기의 과거 기록 수신을 검증했다. 11월 26일 API·Web `33942ae`에서 삭제 기록의 목록 제외와 기존 설치 PWA의 미전송 편집 보존까지 검증했다. [API #171](api-sync-delivery-171-2026-11-25.md) · [API·PWA #182](api-active-log-lists-182-2026-11-26.md)
- **달력 착수 판단.** 기획 #176과 API·Web 기술 검토 #179·#180은 완료됐다. Windows #161과 Apple #163의 공개 설치판 검증 결과가 나오면 본부가 Web/PWA 1단계 착수 여부를 결정한다. [본부 #158](https://github.com/chawon/ott/issues/158#issuecomment-7183368172)
- **상세 기준**: [cross-platform-sync-and-contract-reliability-2026-11-22.md](cross-platform-sync-and-contract-reliability-2026-11-22.md)

### 선행·병행 측정 기반: 첫 기록·기기 연결 계측 정합성 검증 (`#169`)
- **역할**: `first_log_create` vs 서버 첫 기록 계정 의미 정리, 기기 연결(코드·이어받기·향후 QR)의 시도/성공/실패 분모 정의, 다중 기기 실사용 집계 가능 범위 확정.
- **연계**: 2순위(월간 달력) 탐색과 병행해 `#169`를 마무리함으로써 3순위(QR 페어링 `#165`)의 연결·다중 기기 성과를 객관적으로 측정할 수 있게 준비한다.

### 2순위 (다음 탐색 후보 · `#176` 확정 정책 반영): 포스터/표지 '월간 기록 달력' + 저부담 회상 카드
- **배치 사유**:
  - 11월 22일 Apple `2.0.0` 최초 공개, 11월 24일 Apple `2.0.1`·Android `2.0.5` 공개 확인 및 Windows `2.0.1.0` 공개(차기 `2.0.2.0`/`2.0.3.0` 진행)로 전 플랫폼 v2 이용 표본이 새로 쌓이는 시점에 **"기록을 돌아보기 위해 다시 여는 이유"**를 제공한다.
  - Web/PWA 1단계로 먼저 탐색 검증할 수 있으며, 과거 월 전체 조회 가능성과 비용은 [`API 검토 #179`](https://github.com/chawon/ott/issues/179), 부분 캐시·회상 동작은 [`Web/PWA 검토 #180`](https://github.com/chawon/ott/issues/180)에서 선행 확인한다.
- **확정된 1단계 범위 ([`#176` 본부 회신](https://github.com/chawon/ott/issues/176#issuecomment-7123200833))**:
  - **포함**: 월간 달력(기본 상태: `봤어요·읽었어요` + `보는 중·읽는 중`, 위시리스트 `보고 싶어요·읽고 싶어요`는 필터 선택 시 표시) + 저부담 회상 카드(과거 완료 기록 보유 대상).
  - **후속 단계로 분리**: 월간 달력 이미지 저장·공유 및 공유 계측은 1단계 사용 반응을 본 뒤 후속으로 검토한다.
- **성공 지표 및 편향 관리 (1단계 기준)**:
  - 달력 조회자 vs 비조회자 단순 비교(자기 선택 편향)로 인과를 단정하지 않는다.
  - **1단계 탐색 지표**: 노출 대상 Web/PWA 사용자 기준의 **달력 열기·월 이동·날짜 선택**, 과거 완료 기록 보유 대상 기준의 **회상 카드 상세 진입** 및 **도입 전후 완료 주간 코호트 반복 기록 관찰** *(월간 공유 이미지 생성 지표는 후속 단계로 분리)*.
- **착수 관문**: 1순위 안전성 복구 정리 + `#176` 기획안 및 `#179`·`#180` 기술 검토 완료 후 본부 판단으로 착수.

### 3순위 (핵심 다중 기기 연결 후보 · `#169` 선행): QR 코드 기기 연결 (`#165`) 및 안심 연결 · `SavedDiscussionLink` 일관화
- **배치 사유**:
  - 현재 이용자 기반(국내 중심)에서 Web/PWA·Windows·macOS·iPad·iPhone·Android 간 8자리 수동 코드 입력 마찰을 줄여주는 **즉시 체감 가치가 높은 기능**이다.
  - 다만 본부 회신에서 **다중 기기 실사용 비율과 전체 연결 성공률이 현재 미측정**으로 확인됐으므로, `#169`에서 연결 시도/성공/실패 분모와 귀속 정의를 먼저 확정한 뒤 QR 페어링(`#165`) 효과를 검증하는 순서가 타당하다.
  - 초기 기록 이후 복구 카드 보관·QR 연결 안내(노출 시점 건수는 실험 가설), Android·Windows `SavedDiscussionLink` 일관화, Mac 스토어 검증 후 확장 브리지 활성화를 함께 검토한다.
- **상세 초안**: [qr-device-pairing-2026-11-22.md](qr-device-pairing-2026-11-22.md)

---

## 4. 후순위(보류) 및 추가 검토 항목

| 안건 | 문서·이슈 | 본부 판단 | 재검토 조건 |
| --- | --- | --- | --- |
| **외부 기록 가져오기 (Import)** | [#164](https://github.com/chawon/ott/issues/164) · [external-record-import-2026-11-22.md](external-record-import-2026-11-22.md) | **후순위 / 보류로 하향** (사용자 방향 확정: 현재 해외 이용자가 극소수이므로 Letterboxd·Goodreads 등 해외 포맷 우선 추진은 실효성이 낮고, 현재 자체 Web CSV도 작품 ID·ISBN·시즌/회차 부재로 완전 복원 한계가 존재) | ① 해외 유입이 유의미하게 증가하거나, ② 국내 주요 서비스의 공식 내보내기 포맷 확인·자체 CSV 메타 보강이 함께 검토될 때 |
| **Windows 잔여 정합성 범위** | [플랫폼별 차이](../feature-matrix.md) | 11월 28일 `2.0.3.0` 공개 확인, #161 실기기 검증 중 | 교차 동기화 확인 후 시즌/에피소드·서버 이력·KDC·출처 표기 범위 결정 |
