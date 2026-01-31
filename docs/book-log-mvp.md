# 책 기록 MVP 설계 (NAVER Book Search)

## 목표
- OTT 시청 기록(`movie`, `series`) 흐름에 **책(`book`) 기록**을 통합하여 관리
- 국내 도서 메타데이터는 **네이버 책 검색 API**를 활용
- 기존 시스템 아키텍처(Spring Boot + Next.js + Local-first)를 준수하며 최소한의 변경으로 구현

---

## 1. 데이터 모델 및 스키마 변경

### 1.1. TitleType 확장
- **파일:** `apps/api/src/main/java/com/watchlog/api/domain/TitleType.java`
- **변경:** Enum에 `book` 추가
  ```java
  public enum TitleType {
      movie, series, book
  }
  ```

### 1.2. TitleEntity 확장 (titles 테이블)
- **파일:** `apps/api/src/main/java/com/watchlog/api/domain/TitleEntity.java`
- **전략:** 기존 OTT 중심 필드(`directors`, `castNames`)와 별도로 책 전용 메타데이터 컬럼을 추가하여 명확히 분리.
- **추가 필드:**
  - `author` (String, nullable): 저자 (단일 문자열로 병합하여 저장 추천)
  - `publisher` (String, nullable): 출판사
  - `isbn10` (String, nullable, length=10)
  - `isbn13` (String, nullable, length=13)
  - `pubdate` (String, nullable, length=8): YYYYMMDD
- **매핑 전략:**
  - `posterUrl` -> 네이버 책 `image` (해상도가 낮을 수 있으나 MVP 수용)
  - `year` -> `pubdate`의 연도(YYYY) 추출

### 1.3. Provider 확장 (묵시적)
- **개념:** 기존 `TMDB`, `LOCAL` 외에 `NAVER` 추가.
- **Provider ID 전략 (중요):**
  - 네이버 API의 `isbn` 필드는 `"10자리 13자리"` (공백 구분) 형태가 많음.
  - **파싱 로직:** 공백으로 분리(`split`) 후 **13자리**를 우선 사용, 없으면 10자리 사용.
  - **Fallback:** ISBN이 아예 없는 경우(매우 드묾), `link` 필드의 고유 식별자나 URL 해시 사용.
- **providerId 길이/유니크 정책:**
  - `providerId` 컬럼 길이 제한이 있다면 `isbn13`(13) 또는 `link` 기반 해시(권장 40자 내) 수용 가능하도록 상향.
  - `unique(provider, provider_id)` 인덱스 유지. 해시 사용 시 충돌 가능성은 낮지만 **충돌 시 manual merge** 전제.

### 1.4. Edition 기준
- 책은 ISBN 단위로 **Edition 모델**로 저장 (개정판/리커버 구분).
- 동일 작품(Work) 묶음은 **MVP 범위 제외**.

---

## 2. 백엔드 구현 (Spring Boot)

### 2.1. NaverBookClient 구현
- **위치:** `apps/api/src/main/java/com/watchlog/api/naver/NaverBookClient.java` (패키지 신설 권장)
- **기술:** `TmdbClient`와 동일하게 `RestClient` 사용.
- **설정:** `application.yml` 및 환경변수로 Key 관리 (`NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`).
- **헤더:** `X-Naver-Client-Id`, `X-Naver-Client-Secret` 필수.

### 2.2. 검색 API 확장
- **Endpoint:** `GET /api/titles/search`
- **파라미터 변경:** `type` (optional) 추가
  - `q=...` (기존 유지)
  - `type=book` (신규)
- **파라미터 규약:**
  - 허용값: `movie | series | book`
  - 그 외 값은 **400** 응답(에러 메시지 포함) 권장
- **로직 (TitleController):**
  - `type == 'book'`이면 `NaverBookClient.search(q)` 호출.
  - 그 외(null 포함)는 `TmdbClient.searchMulti(q)` 호출 (하위 호환).
- **DTO 확장 (TitleSearchItemDto):**
  - 클라이언트 UI 표시를 위해 `author`, `publisher` 필드 추가 필요.
  - 또는 기존 `description`이나 `overview`에 부가 정보를 포맷팅해서 넣는 방법도 있으나, 필드 추가가 깔끔함.

### 2.3. 상세 조회 및 저장
- **저장:** `POST /api/logs` 요청 시 `titleType=book`, `provider=NAVER` Payload 처리.
- **상세:** `GET /api/titles/{id}`는 DB에 저장된 스냅샷을 반환하므로 추가 구현 불필요.
- **DTO 확장 필요 범위(중요):**
  - `CreateWatchLogRequest`: `author`, `publisher`, `isbn10`, `isbn13`, `pubdate` (옵션)
  - `TitleDto` / `TitleSearchItemDto`: 책 메타 노출 필드 추가
  - `SyncTitlePayload` / `SyncTitleDto`: 로컬 우선 동기화에 책 메타 포함

---

## 3. 프론트엔드 구현 (Next.js)

### 3.1. 타입 정의 업데이트
- **파일:** `apps/web/lib/types.ts`
- **변경:**
  - `TitleType`: `'movie' | 'series' | 'book'`
  - `Provider`: `'TMDB' | 'LOCAL' | 'NAVER'`
  - `Title`, `TitleSearchItem` 인터페이스에 `author`, `publisher` 등 옵셔널 필드 추가.

### 3.2. UI/UX (QuickLogCard)
- **모드 전환:** 검색창 상단 또는 내부에 **[영상 / 책]** 토글(Tab) 배치.
- **책 모드:**
  - 검색 결과 리스트 커스터마이징: 포스터 비율 조정(책은 보통 세로가 더 김), 연도 대신 출판일/저자 표시.
  - 상세 입력 폼: 시즌/에피소드 입력 숨김. '플랫폼(OTT)' 라벨을 '구매처/소장' 등으로 변경하여 표시(데이터는 `ott` 컬럼 공용 사용).
- **필터/통계 주의:**
  - 타임라인 OTT 필터는 **titleType=book**일 때 숨기거나 비활성화 권장.
  - `ott` 필드를 구매처/소장으로 재사용 시, 필터/통계 집계에서 **book 타입 제외** 규칙 필요.

### 3.3. 로컬 동기화 (Dexie/Sync)
- **Outbox:** `titleType=book`인 로그 생성 요청도 큐에 쌓고 온라인 시 전송.
- **Dexie:** `titles` 테이블 스키마 업그레이드(version up) 필요할 수 있음(메타 필드 추가 시).

---

## 4. 체크리스트 & 리스크 관리

### 체크리스트
- [ ] 네이버 개발자 센터 애플리케이션 등록 및 Key 발급 (검색 API)
- [ ] `TitleEntity` 스키마 변경 (Flyway/DDL 확인 필요 - `ddl-auto=update`만 의존하지 않기)
- [ ] ISBN 파싱 유틸리티 테스트 (다양한 포맷 대응)
- [ ] 프론트엔드 타입 가드(`type === 'movie'`) 전수 조사 및 수정
- [ ] DTO/Sync payload에 책 메타 누락 여부 점검

### 리스크
- **이미지 품질:** 네이버 API 제공 이미지는 저해상도일 가능성이 높음. (MVP 수용)
- **카테고리 부재:** 네이버 검색 결과엔 카테고리가 명확치 않을 수 있음. 추후 알라딘 등 타 API 보완 고려.

---

## 5. 구현 순서 (Action Plan)
1.  **Backend:** `TitleType`, `TitleEntity` 확장, `NaverBookClient` 구현.
2.  **Backend:** `TitleController` 검색 로직 분기 및 DTO 매핑.
3.  **Frontend:** `types.ts` 업데이트 및 `QuickLogCard` UI 모드 토글 구현.
4.  **Frontend:** 책 검색 결과 렌더링 및 저장 로직 확인.
5.  **Test:** 검색 -> 저장 -> 타임라인 표시 -> 동기화 전체 사이클 검증.
