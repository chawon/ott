# 활성 기록 목록과 기존 캐시 정정

[실행 이슈 #182](https://github.com/chawon/ott/issues/182) · 담당 API · 협업 Web/PWA · 기준 `main` `1beccebe1b494bbb4d55b3cd7cac6eb684d99550`

2026년 11월 26일 [PR #184](https://github.com/chawon/ott/pull/184)를 `main` `33942ae`에 병합해 API와 Web/PWA에 배포했다. 기존 설치 PWA의 업데이트와 미전송 편집 재시도를 같은 프로필에서 확인했다. [운영 인수](https://github.com/chawon/ott/issues/182#issuecomment-7183186703) · [선행 동기화 변경 #171](api-sync-delivery-171-2026-11-25.md)

## 사용자 문제와 완료 조건

목록 조회는 soft-delete 행을 반환하면서 DTO에 삭제 시각을 싣지 않았다. 새 캐시는 삭제된 기록을 활성으로 표시할 수 있었다. 삭제를 이미 받은 캐시는 해당 ID의 tombstone이 있으면 보호됐지만, 동일 작품의 다른 활성 기록을 정리하는 경로에서 tombstone이 사라지면 늦은 구 목록 응답이 삭제 행을 다시 활성으로 만들 수 있었다.

- 일반·단일 OTT·쉼표로 구분한 복수 OTT 목록은 활성 기록만 반환한다. 기본 감상 시각 정렬과 수정 시각 정렬에서 페이지 경계를 따라 활성 기록을 빠짐없이 한 번씩 읽는다.
- 목록에서 제외해도 기존 기기는 증분 동기화로 삭제 신호를 계속 받는다. 과거 복구·동률·재시도·지연 커밋과 최신 원격 편집 보호는 #171의 회귀로 확인한다.
- 새 캐시, 이미 삭제를 받은 캐시, 과거 목록으로 오염되고 cursor까지 진행한 캐시의 활성 기록이 수렴해야 한다. 미전송 편집과 outbox를 보존하고 늦은 구 목록으로 재발하지 않게 한다.

영상·책, 한국어·영어에 같은 데이터 규칙을 적용한다. 사용자용 개별 삭제 기능이나 달력 기능을 추가하지 않는다. 운영 사용자 수·빈도나 개선율은 이 합성 검증으로 추정하지 않는다.

## API 계약과 구현

`WatchLogRepository.findFiltered`와 `findFilteredWithOttPatterns`에 `deleted_at is null`을 추가한다. `LogService.list`와 `listPage`가 두 쿼리를 공유하므로 배열·cursor 목록 모두 같은 필터를 적용하며, 필터를 적용한 뒤 limit와 다음 cursor를 계산한다.

- `GET /api/logs`의 배열 응답과 최대 100건 제한을 유지한다.
- `GET /api/logs/page`의 `{items, nextCursor}`, 1~100건 제한, 감상/수정 시각과 UUID의 기존 키셋 순서를 유지한다. `book|video` 필터도 유지한다.
- 목록 DTO·인증·기존 ID·사용자 논리 시각·DB 스키마를 바꾸지 않는다. Flyway 변경은 없다.
- `findUserChangesAfter`와 `findForSyncDelivery`는 삭제행을 계속 조회한다. `GET /api/sync/pull`의 full/delta 응답과 #171의 기기 cursor 인정·전달 경계는 바꾸지 않는다.
- 응답 필드가 늘거나 타입이 변하지 않아 기존 배열/페이지 파서는 그대로 사용한다. 서버의 활성 목록을 받았다는 사실만으로 로컬에서 보이지 않는 모든 기록을 삭제하면 미전송 편집이나 아직 조회하지 않은 페이지를 잃을 수 있어 그렇게 처리하지 않는다.

## 기존 캐시에서 구분한 상태

1. **새 캐시:** 수정된 API 목록은 삭제행을 처음부터 전달하지 않는다.
2. **삭제 이전 cursor / tombstone 보유:** 정상 증분 pull이 기존 삭제 신호를 전달하며, 목록 병합이 그 신호를 지우지 않아야 한다.
3. **삭제 이후 cursor / 활성으로 남은 구 목록 행:** 변경이 없는 정상 delta는 비어 있고 활성 목록 재조회는 upsert만 하므로, 그 두 동작만으로 기존 오염을 알아낼 수 없다. 안전한 전체 재대조와 tombstone 보존이 필요하다.

세 번째 상태는 임의의 운영 DB 조작 없이 재현했다. 실제 `SyncService`로 D를 삭제하고 같은 작품을 과거 시각의 새 ID N으로 복구하면 delta 순서는 `[D tombstone, N active]`다. 기준 Web의 실제 `cacheLog`와 Dexie 저장 함수가 N의 중복 정리 중 D tombstone을 지운 뒤, 늦은 구 목록 DTO를 받아 D를 활성으로 삽입한다. cursor는 이미 삭제 뒤로 진행해 있어 다음 delta와 수정된 활성 목록 조회 뒤에도 D가 남고, 명시적 full pull 뒤에야 N만 남았다.

Web의 기존 `syncNow` 경로는 구 버전의 성공 cursor를 새 체크포인트로 승계하지 않고 한 번 full pull을 한다. 현재 계정의 응답을 Dexie 트랜잭션에 모두 반영한 뒤에만 계정·cursor를 `watchlog.logCacheCheckpoint.v1`에 저장하고, 다음 sync부터 증분을 요청한다. 오프라인·HTTP 실패·계정 교체·로컬 반영 실패는 성공으로 표시하지 않는다. 계정 초기화는 새 체크포인트도 제거한다.

- 삭제행을 먼저 반영하고, 같은 작품의 활성 기록을 정리해도 삭제행과 그 이력은 보관한다. 목록의 단순 부재로 로컬 행을 지우지 않는다.
- 늦은 구 목록은 tombstone과 미전송 편집을 덮지 못한다. 응답을 기다리는 사이 계정이 바뀌면 원래 계정의 목록·이력은 새 계정에 저장하지 않는다.
- 더 최신의 정상 sync는 같은 ID의 복구를 허용한다. 삭제보다 1µs 뒤의 복구도 기존 9자리 시각 비교로 받고, 이전·동일 시각의 활성 응답은 tombstone을 되살리지 않는다.
- 작품별 로컬 조회는 삭제행을 제외한 뒤 limit를 적용하며, 홈의 활성 건수와 상세 화면도 보관 중인 tombstone을 활성 기록으로 세지 않는다. API 목록이 도착해도 표시할 현재 기록은 로컬 병합 후 고른다.

배포 후 기존 기기는 계정의 전체 로그(삭제 포함)와 기존 full pull 계약의 공용 제목을 한 번 더 받는다. 초기 비용과 #171의 전역 pull fence 보유 시간이 늘 수 있다. 페이지 목록만으로 과거 오염을 식별할 수 없고 기존 sync DTO를 바꾸지 않기 위해 이 방식을 선택했다. 이력과 tombstone을 보관하며 캐시 초기화로 대체하지 않는다.

## 플랫폼별 영향

| 대상 | 변경과 검증 | 상태 |
| --- | --- | --- |
| API | 두 목록 SQL에 활성 조건, 기존 PostgreSQL 통합 suite에 목록·페이지·증분 삭제 회귀 추가 | 운영 배포 및 합성 계정의 공개 API 확인 완료 |
| Web / 설치 PWA / 구 TWA·Windows PWA | `sync.ts`·`localStore.ts`와 홈/타임라인/상세에서 기존 오염 복구와 재발 방어. 실제 Dexie·Web 함수·Chromium으로 검증하고 설치형 캐시도 같은 소스를 사용 | Web 배포 및 기존 데스크톱 Chromium 설치 PWA 확인 완료. 구 TWA·Windows PWA는 공통 Web 코드 적용 |
| Android 네이티브 / iPhone / iPad / Windows 네이티브 / macOS | 제품 코드·바이너리 변경 없음. 기존 sync DTO·삭제 전달은 유지. 해당 설치판의 개별 캐시 동작을 Web 실험으로 대신 확인하지 않음 | API 호환 회귀, 실기기 변경 검증 범위 밖 |
| Chrome·Edge·Whale 확장 / 토스 / ChatGPT 앱 | 패키지·통합 코드 변경 없음. ChatGPT는 미운영이며 기존 읽기 전용 계약 유지 | 별도 출시 없음 |

## 배포 전 검증 근거

운영 데이터는 사용하지 않고 전용 PostgreSQL 16 cluster와 무작위 schema·합성 계정/기기/작품을 사용했다. schema는 suite 종료 때 제거한다.

- 신규 11개 회귀가 수정 전 실패하는 것을 확인했다. 일반/단일/복수 OTT, 감상/수정 정렬, 책/영상, 같은 시각의 UUID 경계, 다른 계정 제외, 삭제만 있는 목록과 cursor 종료, sync tombstone, 동일 작품의 과거 복구를 포함한다.
- 각 목록 fixture는 자기 계정 226행 중 삭제 75행을 포함한다. 활성 151행을 cursor로 끝까지 읽고 예상 ID 순서와 정확히 비교해 중복·누락을 확인한다. OTT·콘텐츠 필터는 같은 fixture의 해당 부분집합으로 확인한다.
- 수정 후 `SyncDeliveryDatabaseTest` **32/32 통과**: 기존 #171 21개 + 신규 #182 11개.
- 실제 API에서 삭제 후 1µs의 같은 ID 복구가 수락되고, 인정된 이전 cursor의 정상 delta에 원래 `updatedAt`·`deletedAt=null`로 전달되는 것도 같은 suite에서 확인했다.
- 로컬 `./gradlew test bootJar --no-daemon --max-workers=2` 성공. 전체 250건 중 실행 227건 통과, Docker 전용 23건은 실행하지 못했다. 병합본 CI에서는 전체 250개가 생략 없이 통과했고 ARM64 컨테이너와 기존 DB 업그레이드도 확인했다. [API CI](https://github.com/chawon/ott/actions/runs/45759188747)
- 통합 브랜치에서 `npm run test:timeline-v2 --workspace ott` **59/59 통과**. 기존 캐시 교정·두 응답 순서·늦은 목록·동일 ID 복구·실패/재시작·미전송 편집·계정 교체와 기존 충돌 복구를 검증한다.
- Web 담당이 production build·타입 검사와 변경 파일 Biome 오류 0을 확인했다. 전체 Web lint는 고정 기준 커밋의 기존 22오류·71경고·23정보와 파일/규칙별 동일하다.
- `BACKEND_URL=http://127.0.0.1:8080 npm run test:timeline-scroll --workspace ott`는 격리 브라우저의 실제 IndexedDB와 합성 HTTP 응답을 사용한다. 호스트의 Chromium 실행 파일은 `PLAYWRIGHT_EXECUTABLE_PATH`로 지정할 수 있다. 구 캐시 full 교정→지연 목록 무해→503 중 메모/operation/이력 보존→재시작 후 같은 payload 재전송·정식 ID 이력 귀속·대기열 0·증분 복귀와 기존 50/51/125건 스크롤을 확인한다. 운영 서버나 실제 설치 PWA를 호출하는 검증은 아니다.
- 최초 브라우저 검사의 고정 pull 횟수는 default `next dev`에서 `[full, delta, delta]`로 실패했고 같은 코드의 production에서는 `[full, delta]`로 통과했다. Web 담당이 개발 모드의 effect 등록·해제·재등록을 관측했다. 검사만 보완해 응답마다 새 cursor를 발급하고 모든 요청의 계정/기기·직전 응답 cursor·재시작 시 저장된 cursor를 검사한다. full은 정확히 한 번, 쓰기는 동일 payload의 503 한 번과 수락 한 번임을 유지한다. 추가 읽기와 실제 중복 쓰기를 구분하며 default dev·production 둘 다 확인한다.
- 임시 기준 코드 진단은 소스에서 제거했다. 영구 회귀는 기존 Web 테스트 경로에 통합했다.

## 2026-11-26 운영 배포와 인수

[병합 커밋 `33942ae`](https://github.com/chawon/ott/commit/33942ae09106a5ce08e4838ef5552fee152a3046)의 [API CI](https://github.com/chawon/ott/actions/runs/45759188747)와 [Web CI](https://github.com/chawon/ott/actions/runs/45759188673)가 통과했다. 같은 커밋의 API를 배포하고 실제 목록과 기기 간 삭제 수신을 확인한 뒤 Web을 배포했다. [API 배포](https://github.com/chawon/ott/actions/runs/45759656893) · [API 매니페스트](https://github.com/chawon/ott/commit/c1f93e28220294c3985f0620a6dd4ef836bac3c5) · [Web 배포](https://github.com/chawon/ott/actions/runs/45759995665) · [Web 매니페스트](https://github.com/chawon/ott/commit/9e8d680bbcd441268704843c1d487b4e1554299c)

- **목록과 동기화.** 같은 합성 계정에서 구 API의 일반·단일 OTT·복수 OTT 목록은 각각 19·9·18건이었고 삭제 기록 6·3·6건을 포함했다. 배포 후 13·6·12건이었으며 두 정렬 모두 마지막 페이지까지 활성 ID가 누락이나 중복 없이 일치했다. 다른 기기에서 합성 기록 하나를 삭제하자 기존 기기의 다음 증분 응답에 삭제 1건이 왔고, 그다음 응답은 0건이었다. 이때 공개 `/api/logs`도 HTTP 200과 활성 12건을 반환했다.
- **기존 기기의 첫 동기화 비용.** 합성 계정에서 운영 Pod에 포워딩해 한 번 측정한 전체 응답은 527,335바이트·200ms였다. 다음 증분은 75바이트·34ms였다. 기존 캐시를 가진 설치판의 첫 동기화는 계정의 기록과 공용 제목을 함께 받는다.
- **기존 설치 PWA.** 운영 `8c8b064`를 실제로 설치한 Linux Chromium 147의 같은 프로필에서 업데이트했다. 기존 서비스워커에 보관한 구 운영 HTML·JS와 실제 구 목록을 재생해 잘못 저장된 행을 재현했다. 구 앱 UI 저장·구 캐시 재현·새 앱 복구에서 전송 실패(503)를 각각 한 번 제어했다. 실제 운영 쓰기는 마지막 편집 한 건이었다. 새 Web의 실제 전체 동기화 1회 뒤 구 목록을 재생해도 삭제된 카드는 0개, 같은 작품의 활성 카드와 편집 중인 카드는 각각 1개였다. 앱과 브라우저를 완전히 종료했다가 다시 열자 첫 요청이 저장된 커서에서 시작했고 전체 조회 없이 증분만 받았다. 원래 편집은 실제 서버에 한 번 전송돼 한 번 수락됐다. 대기열은 0건이 됐고 기존 이력 ID와 메모가 보존됐다. 해당 합성 기록의 서버 이력은 1건에서 2건으로 늘었고 상세 화면에도 새 이력 한 건이 표시됐다.
- **운영 상태.** 두 서비스의 엔드포인트는 각각 새 Pod 하나를 가리켰다. 두 이미지 태그는 병합 커밋의 전체 SHA였고 `APP_VERSION`은 `33942ae`였다. 각 Pod는 1/1 Ready·재시작 0회, Argo CD는 `Synced / Healthy`였다. Web 교체 직후 공개 버전 조회에서 HTTP 502가 한 번 관측됐다. 이후 새 버전과 `/en/timeline`을 각각 5회 연속 HTTP 200으로 확인했다. [공개 Web 버전](https://ottline.app/.well-known/ottline-version)
- **정리.** 시험에서 만든 계정·기기·작품·기록·이력·동기화 참조·분석 행은 모두 0건이 됐다. 정리한 시험 기기의 요청은 401이었고 일반 계정·기기·기록·이력 및 미귀속 기록의 전후 건수가 일치했다. [본부 운영 인수](https://github.com/chawon/ott/issues/182#issuecomment-7183186703)

### 이전 이미지로 되돌릴 때

이전 API 이미지는 삭제 행을 목록에 포함하고 이전 Web 이미지는 늦게 도착한 목록 응답을 다시 저장할 수 있다. 되돌리는 구성 요소에 맞춰 목록의 삭제 제외, 기존 기기의 삭제 수신, 로컬 캐시와 미전송 편집 보존을 다시 확인한다. 서버 행과 이력, #171 전달 정보는 이 배포에서 보존했다.
