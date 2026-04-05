# 책 기록 (Book Log)

> 네이버 책 검색 API 연동으로 영상 기록 흐름에 책 기록을 통합한 MVP

## 관련 페이지
- [[analytics]]
- [[share-card]]
- [[timeline-export]]

---

## 목표

기존 OTT 시청 기록(`movie`, `series`) 흐름에 **책(`book`) 기록**을 통합. 국내 도서 메타데이터는 네이버 책 검색 API를 활용하며, 기존 시스템 아키텍처(Spring Boot + Next.js + Local-first)를 최소한의 변경으로 확장.

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
- `pubdate` (String, nullable, YYYYMMDD)

**매핑:** `posterUrl` → 네이버 `image`, `year` → `pubdate`에서 연도 추출

### Provider 확장
- 기존: `TMDB`, `LOCAL`
- 신규: `NAVER`

**providerId 전략:** 네이버 API `isbn` 필드(`"10자리 13자리"` 공백 구분)에서 13자리 우선 사용, 없으면 10자리. ISBN 없으면 link URL 해시.

---

## 백엔드 구현

### NaverBookClient
- 위치: `apps/api/src/main/java/com/watchlog/api/naver/NaverBookClient.java`
- `RestClient` 사용 (TmdbClient와 동일 방식)
- 헤더: `X-Naver-Client-Id`, `X-Naver-Client-Secret`
- 환경변수: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`

### 검색 API 확장
- `GET /api/titles/search?q=...&type=book`
- `type == 'book'` → `NaverBookClient.search(q)` 호출
- `type` 없거나 movie/series → `TmdbClient.searchMulti(q)` (하위 호환)
- 허용값 외 → 400 응답

---

## 프론트엔드 구현

### 타입 정의 (`apps/web/lib/types.ts`)
```ts
TitleType: 'movie' | 'series' | 'book'
Provider: 'TMDB' | 'LOCAL' | 'NAVER'
```

### UI/UX (QuickLogCard)
- 검색창 상단에 **[영상 / 책]** 토글(Tab) 배치
- 책 모드: 포스터 비율 조정(세로 더 긴 비율), 연도 대신 출판일/저자 표시
- 시즌/에피소드 입력 숨김, '플랫폼(OTT)' 라벨 → '구매처/소장' 변경

### 로컬 동기화
- `titleType=book` 로그 생성 요청도 Outbox 큐에 적재
- Dexie `titles` 테이블 스키마 업그레이드 필요 가능성

---

## 리스크

- 네이버 API 제공 이미지: 저해상도 가능성 높음 (MVP 수용)
- 카테고리 정보 없을 수 있음 → 추후 알라딘 등 보완 고려
- 프론트엔드 `type === 'movie'` 타입 가드 전수 조사 필요
