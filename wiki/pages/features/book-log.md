# 책 기록 (Book Log)

> 한국어 Kakao·영어 Google Books 검색과 기존 ISBN 판본 연결로 영상 기록 흐름에 책 기록을 통합

## 관련 페이지
- [[analytics]]
- [[share-card]]
- [[timeline-export]]

---

## 목표

기존 OTT 시청 기록(`movie`, `series`) 흐름에 **책(`book`) 기록**을 통합. 한국어는 Kakao, 영어는 Google Books를 활용하며, 기존 시스템 아키텍처(Spring Boot + Next.js + Local-first)를 유지한다. Google Books 추가의 운영 배포 상태는 [구현·검증 문서](../../../docs/google-books-en-search.md)를 따른다.

---

## 데이터 모델 변경

### TitleType 확장
```java
public enum TitleType {
    movie, series, book
}
```

### TitleEntity 추가 필드 (titles 테이블)
- `author` (String, nullable): 저자
- `publisher` (String, nullable): 출판사
- `isbn10` (String, nullable, 10자)
- `isbn13` (String, nullable, 13자)
- `pubdate` (String, nullable, YYYYMMDD; Google의 부분 날짜는 YYYY 또는 YYYYMM)

**매핑:** `posterUrl` ← 카카오 `thumbnail`, `author` ← `authors` 배열 결합, `pubdate` ← `datetime`의 현지 날짜, `year` ← 출판 연도

### Provider 확장
- 영상/직접 입력: `TMDB`, `LOCAL`
- 새 책: 한국어 `KAKAO`, 영어 `GOOGLE_BOOKS`
- 기존 책 식별자: `NAVER` 유지

**providerId 전략:** Kakao는 체크섬을 검증한 ISBN-13을 사용하고 ISBN-10은 13자리로 변환한다. ISBN이 없으면 상세 URL의 SHA-256 앞 40자리를 사용한다. Google은 ISBN 유무와 관계없이 opaque volume ID를 사용한다. 같은 ISBN 판본의 기존 NAVER/KAKAO/GOOGLE_BOOKS 책이 있으면 기존 provider/providerId와 titleId를 반환한다. 번역본·다른 판본은 합치지 않는다.

---

## 백엔드 구현

### KakaoBookClient / BookSearchService
- 위치: `apps/api/src/main/java/com/watchlog/api/kakao/KakaoBookClient.java`
- `RestClient`로 `GET /v3/search/book` 호출, `BookSearchService`에서 기존 판본 연결
- 헤더: `Authorization: KakaoAK ...`
- 환경변수: `KAKAO_API_KEY` (OCI Vault → ExternalSecret)
- 연결 3초, 응답 5초 제한. 키 미설정/쿼터 초과는 503, 외부 응답/연결/파싱 오류는 502.

### 검색 API 확장
- `GET /api/titles/search?q=...&type=book`
- `type == 'book'` → `BookSearchService.search(q, language)` 호출. 지원 언어의 우선순위에 따라 영어는 Google, 한국어/기본값은 Kakao로 라우팅한다.
- 기존 iOS 앱은 Kakao를 유지한다. 새 iOS 바이너리가 출처 표시와 원문 링크를 지원한다는 헤더를 보내면 영어 검색을 Google로 전환한다.
- Google 검색의 `sourceUrl`은 ISBN 매칭으로 기존 provider를 재사용해도 원문 링크를 유지한다. 검색창·결과·선택 화면은 공식 Google 출처 표시와 원문 링크를 제공한다.
- Google 서버 키는 `GOOGLE_BOOKS_API_KEY`이며 OCI Vault → 별도 `ott-google-books-secrets` ExternalSecret → API Pod로 주입한다.
- `type` 없거나 movie/series → `TmdbClient.searchMulti(q)` (하위 호환)

---

## 프론트엔드 구현

### 타입 정의 (`apps/web/lib/types.ts`)
```ts
TitleType: 'movie' | 'series' | 'book'
Provider: 'TMDB' | 'LOCAL' | 'NAVER' | 'KAKAO' | 'GOOGLE_BOOKS'
```

### UI/UX (QuickLogCard)
- 검색창 상단에 **[영상 / 책]** 토글(Tab) 배치
- 책 모드: 포스터 비율 조정(세로 더 긴 비율), 연도 대신 출판일/저자 표시
- 시즌/에피소드 입력 숨김, '플랫폼(OTT)' 라벨 → '구매처/소장' 변경

### 로컬 동기화
- `titleType=book` 로그 생성 요청도 Outbox 큐에 적재
- 웹 로컬 캐시와 서버 저장/동기화에서 ISBN-10/13 및 NAVER/KAKAO/GOOGLE_BOOKS 별칭을 연결
- 구버전 네이티브의 LOCAL fallback도 서버의 기존 책 식별자를 덮어쓰지 않도록 처리

---

## 리스크

- 카카오 검색에는 KDC 분류가 없으므로 기존 도서관 정보나루 분류 경로를 유지한다.
- 이미 저장된 중복 책 ID를 일괄 병합하지 않는다.
- 전환 절차와 배포 검증: [카카오 책 검색 전환](../../../docs/kakao-book-search.md)
