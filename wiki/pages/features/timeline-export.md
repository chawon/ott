# 타임라인 내보내기 (CSV/XLSX)

> 사용자가 자신의 타임라인을 CSV 또는 엑셀로 소유하는 기능, 복원(Import)은 MVP 제외

## 관련 페이지
- [[book-log]]
- [[delete-sync]]

---

## 목표

- 내 기록을 CSV 또는 XLSX로 내려받기
- 엑셀에서 열었을 때 한글 깨지지 않는 형식 제공
- 레트로/기본 모드와 무관하게 **설정 화면에서 접근**

---

## CSV 컬럼

| 컬럼 | 설명 |
|---|---|
| `watchedAt` | YYYY-MM-DD |
| `title` | 작품명 |
| `type` | 영화/시리즈/책 |
| `status` | 봤어요/보는 중/보고 싶어요 등 |
| `rating` | 숫자 |
| `note` | 메모 |
| `place` | 장소 |
| `occasion` | 누구와 |
| `ott_or_platform` | 플랫폼/구매처 |

---

## 파일 포맷

**CSV:**
- UTF-8 with BOM (엑셀 한글 깨짐 방지)
- RFC 4180 방식 이스케이프

**XLSX:**
- SheetJS(`xlsx`) 사용
- 워크시트 이름: `timeline`

---

## 데이터 소스

**MVP: 로컬(IndexedDB/Dexie) 기반**
- 장점: 구현 간단, 서버 의존 없음
- 단점: 로컬에 없는 데이터 누락 가능
- 안내 문구: "최신 동기화 후 내보내기" 권장

---

## 구현 (프론트)

```
lib/export.ts
├── buildExportRows(logs: WatchLog[])
├── downloadCsv(rows)
└── downloadXlsx(rows)
```

`localStore`에서 `db.logs.toArray()` + `deletedAt` 필터 후 내보내기

**위치:** 설정 화면(`apps/web/app/account/page.tsx`) 내 "내 기록 내보내기" 섹션

---

## 보안 이슈 (코드 리뷰 발견)

**CSV Formula Injection 방어 부재:**
- `apps/web/lib/export.ts`의 `escapeCsv`는 따옴표 이스케이프만 처리
- `=`, `+`, `-`, `@`로 시작하는 셀 값이 엑셀에서 수식으로 실행될 수 있음
- **해결책:** 해당 패턴 시작 시 `'` prefix 적용 (예: `'=HYPERLINK(...)`)
