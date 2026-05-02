# 타임라인

> 사용자의 영상/책 기록을 최신 수정 순 또는 감상일 기준으로 탐색하는 개인 기록 화면

## 관련 페이지
- [[book-log]]
- [[timeline-export]]
- [[delete-sync]]

---

## 구현 상태

- `apps/web/app/[locale]/timeline/page.tsx`에서 타임라인 목록, 필터, CSV 내보내기, 미래의 타임라인 추천 전환을 제공한다.
- `apps/web/components/FiltersBar.tsx`에서 콘텐츠 타입, 상태, 출처, 플랫폼, 검색어 필터를 관리한다.
- 검색어 필터는 제목, 메모, 플랫폼, 도서 저자/출판사를 대상으로 한다.
- 서버 동기화 계정은 `GET /api/logs?q=...`로 서버 결과를 먼저 가져온 뒤 IndexedDB에 반영하고, 로컬 필터를 다시 적용한다.
- 오프라인 또는 서버 실패 시에는 IndexedDB의 `listLogsLocal()` 필터 결과를 유지한다.

---

## API 계약

- `GET /api/logs?limit=&status=&origin=&ott=&q=&place=&occasion=&titleId=&sort=`
- `q`: 제목/메모/플랫폼/도서 저자·출판사 검색
- `sort=history`: `updatedAt` 기준 최신 수정 순

---

## 운영 메모

- 타임라인 검색은 추천보다 기록 재방문 가치를 직접 높이는 기본 탐색 기능이다.
- 검색 조건은 CSV 내보내기에도 동일하게 적용된다.
