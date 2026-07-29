# KDC 내 서가 v1

## 목적

기록한 책을 시간순 목록으로만 두지 않고, 한국십진분류법(KDC)의 10개 대분류 서가에 자동으로 꽂아 보여준다. 사용자는 기록할 때 분류를 입력하지 않는다. 기존 QuickLog의 빠른 저장 흐름을 유지하면서, 저장한 책이 취향의 지도로 쌓이는 감각을 더하는 기능이다.

이 기능은 콘텐츠 추천이 아니다. 새로운 책을 제안하거나 완독률·정복률을 평가하지 않고, 사용자가 이미 남긴 기록만 정리한다.

## 사용자 경험

1. 타임라인은 시간순 기록 흐름을 우선한다. 한국어 화면에서 책 필터를 선택하면 필터 아래의 작은 `서가 보기` 링크로 진입한다.
2. `/[locale]/me/bookshelf`는 최근 책, KDC 0~9 서가 지도, 선택한 주제의 책, 아직 분류되지 않은 책을 한 화면에 보여준다.
3. 책의 상태가 `다 읽었어요`, `읽는 중`, `읽고 싶어요` 중 무엇이든 동일하게 서가에 포함한다.
4. 동일 ISBN-13 판본을 여러 번 기록한 경우 한 권으로 계산하고 가장 최근 기록 상태를 사용한다.
5. ISBN-13이 없고 유효한 ISBN-10만 있으면 ISBN-13으로 변환한다. ISBN이 없거나 분류 정보를 찾지 못한 책은 `자리를 찾는 책`에 남긴다.
6. QuickLog에서 책을 저장하면 기록 저장과 동기화를 막지 않는 백그라운드 요청으로 분류를 확인한다. 결과가 빠르게 도착하면 저장 완료 배너에서 해당 서가로 바로 이동할 수 있다.
7. 로컬 캐시를 먼저 렌더하므로 오프라인에서도 기존 서가를 볼 수 있다.

KDC는 한국 고유 분류 체계이므로 서가와 관련 진입점은 한국어 화면에서만 제공한다. 영어 경로로 직접 접근하면 영어 타임라인으로 돌려보낸다. 개인 화면이므로 검색엔진에는 `noindex`로 제공한다.

## 분류 계약

### 서버 API

`POST /api/titles/book-classifications/resolve`

요청 예시:

```json
{
  "isbn13s": ["9788983921987"]
}
```

응답 예시:

```json
{
  "items": [
    {
      "isbn13": "9788983921987",
      "kdcCode": "813.7",
      "kdcMajor": 8,
      "status": "RESOLVED",
      "fetchedAt": "2026-07-25T12:00:00+09:00"
    }
  ]
}
```

- 한 요청 배열은 유효한 ISBN-13 최대 50개를 받고 서버에서 중복을 제거한다.
- 외부 데이터는 도서관 정보나루의 도서 상세 조회 API `srchDtlList`에서 받은 `class_no`를 사용한다.
- `class_no`의 첫 숫자만 서가 대분류 `0`~`9`로 사용하고 원래 코드는 함께 보관한다.
- `RESOLVED`는 영구 캐시한다.
- `NOT_FOUND`는 30일간 캐시한 뒤 다시 확인한다.
- 인증 키 누락이나 외부 장애는 `503 Service Unavailable`로 반환한다. 찾지 못한 정상 응답은 `NOT_FOUND`다.

관련 공식 문서: [도서관 정보나루 Open API 활용](https://www.data4library.kr/apiUtilization)

### 저장소

- PostgreSQL: Flyway `V29__book_classifications.sql`
- 브라우저: Dexie schema v3의 `bookClassifications`
- 브라우저 로컬 초기화 시 분류 캐시도 함께 삭제한다.
- 분류 원본은 모든 사용자에게 공통인 ISBN 단위 데이터이므로 계정별 테이블에 중복 저장하지 않는다.

## UI 원칙

- 실제 책 표지를 먼저 보여주고, 표지가 없을 때만 단순한 책 아이콘을 쓴다.
- 따뜻한 종이색 배경과 흰 카드, 얇은 서가 선을 사용한다.
- 선택된 서가에는 네이비를 쓰고, 오렌지는 첫 책 기록 CTA와 포커스 링에만 쓴다.
- 분류 숫자보다 `책이 제자리를 찾아간다`는 문장을 먼저 전달한다.
- 완성률, 빈 슬롯 압박, 연속 기록 보상은 v1에 넣지 않는다.
- 모바일은 2열, 넓은 화면은 5열로 10개 대분류를 한 번에 훑을 수 있게 한다.

## Analytics

- `bookshelf_open`: 전체 책 수, 분류된 책 수, 대기 중 책 수, 사용 중인 주제 수
- `bookshelf_category_open`: KDC 대분류와 해당 책 수

기존 `log_create`와 `first_log_create` 계약은 바꾸지 않는다.

## 운영 설정과 배포 게이트

API 환경변수:

- `DATA4LIBRARY_BASE_URL` — 기본값 `https://data4library.kr`
- `DATA4LIBRARY_AUTH_KEY` — 필수 운영 비밀값

OKE ExternalSecret에는 `DATA4LIBRARY_AUTH_KEY` 매핑이 포함되어 있다. 프로덕션 배포 전에 OCI Vault에 같은 이름의 비밀값을 만들고 ExternalSecret 동기화 상태를 확인해야 한다. 키가 없는 상태에서도 QuickLog 기록은 저장되지만 모든 책이 `자리를 찾는 책`으로 남으므로, 운영 키 준비 전에는 배포하지 않는다.

## 검증

```bash
cd apps/api
GRADLE_USER_HOME=./.gradle ./gradlew test \
  --tests com.watchlog.api.data4library.Data4LibraryClientTest \
  --tests com.watchlog.api.service.BookClassificationServiceTest

cd ../web
node --test lib/bookshelf.test.mjs

cd ../..
npm run build --workspace ott
```

검증 범위는 도서나루 응답 파싱, KDC 대분류 추출, ISBN 검증, 성공/미조회 캐시, 판본 중복 제거, 세 가지 기록 상태 집계, 분류 대기 영역, 한국어·영어 프로덕션 빌드를 포함한다.
