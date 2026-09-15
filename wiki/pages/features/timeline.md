# 타임라인

> 사용자의 영상/책 기록을 최신 수정 순 또는 감상일 기준으로 탐색하는 개인 기록 화면

## 관련 페이지
- [[book-log]]
- [[personal-profile]]
- [[timeline-export]]
- [[delete-sync]]

---

## 구현 상태

- `apps/web/app/[locale]/timeline/page.tsx`에서 타임라인 목록, 필터, CSV 내보내기, 미래의 타임라인 추천 전환을 제공한다.
- `apps/web/components/FiltersBar.tsx`에서 콘텐츠 타입, 상태, 출처, 플랫폼, 검색어 필터를 관리한다.
- 검색어 필터는 제목, 메모, 플랫폼, 도서 저자/출판사를 대상으로 한다.
- 개인 프로필이 완성된 경우 제목과 CTA 일부에 닉네임을 반영한다. 예: `{nickname}의 타임라인`, `{nickname}의 미래는?`.
- 서버 동기화 계정은 `GET /api/logs/page`로 처음 50개를 받고, 하단에 도달할 때 `nextCursor`로 이전 기록을 50개씩 이어서 조회한다.
- 서버 페이지를 IndexedDB에 반영한 뒤 로컬 필터를 다시 적용한다. 오프라인 또는 서버 실패 시에는 이미 저장된 `listLogsLocal()` 결과를 유지한다.
- iOS 네이티브 앱은 별도 `GET /api/sync/pull?since=` 계약과 SQLite 전체 조회를 사용하므로 웹 타임라인 페이지 계약의 영향을 받지 않는다.

---

## API 계약

- `GET /api/logs?limit=&status=&origin=&ott=&q=&place=&occasion=&titleId=&sort=`
- `GET /api/logs/page?limit=&status=&origin=&ott=&q=&place=&occasion=&titleId=&sort=&contentType=&cursor=`
- 페이지 응답: `{ items, nextCursor }`. `nextCursor`는 정렬 시각과 UUID를 묶은 불투명 키셋 커서다.
- `contentType`: `book|video`, `limit`: 1~100
- `q`: 제목/메모/플랫폼/도서 저자·출판사 검색
- `sort=history`: `updatedAt` 기준 최신 수정 순

---

## 운영 메모

- 타임라인 검색은 추천보다 기록 재방문 가치를 직접 높이는 기본 탐색 기능이다.
- 검색 조건은 CSV 내보내기에도 동일하게 적용된다.
- API를 먼저 배포한 뒤 `/api/logs/page`를 호출하는 웹을 배포한다.
