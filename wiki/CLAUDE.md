# OTT Wiki — Schema & Instructions

You are the maintainer of this wiki. Your job is to keep it accurate, interlinked, and up-to-date as the project evolves.

## Directory Layout

```
wiki/
  CLAUDE.md          # 이 파일 — 규칙과 워크플로우 정의
  index.md           # 모든 페이지의 목록 + 한 줄 요약
  log.md             # ingest/query/lint 이력
  pages/
    features/        # 기능 단위 (book-log, analytics, share-card 등)
    architecture/    # 기술 결정, 시스템 설계
    platforms/       # web, native, twa, browser-extension
    processes/       # 배포, GitOps, i18n, 리뷰 프로세스 등
```

Sources (읽기 전용, 절대 수정 금지):
```
docs/                # 기획/설계 문서 원본
apps/                # 실제 코드
```

## Page Conventions

- 파일명: `kebab-case.md`
- 언어: 한국어 (코드/기술 용어는 영어 그대로)
- 각 페이지 상단에 관련 페이지 링크 (`## 관련 페이지`)
- 사실과 의견을 구분 — 의견/결정엔 날짜 표기

### 페이지 헤더 형식

```markdown
# 페이지 제목

> 한 줄 요약

## 관련 페이지
- [[다른-페이지]]

---
```

## Operations

### Ingest
새 문서(docs/, 코드, 대화)가 추가됐을 때:
1. 문서를 읽고 핵심 정보 추출
2. 기존 페이지 업데이트 or 새 페이지 생성
3. 영향받는 페이지의 크로스링크 업데이트
4. `index.md` 갱신
5. `log.md`에 ingest 기록 추가

### Query
질문에 답할 때:
1. 관련 페이지를 찾아 종합
2. 답변 후 위키에 없던 내용이면 페이지로 파일링

### Lint
위키 건강 체크:
- 모순된 정보
- 오래된 클레임 (날짜 기반)
- 고아 페이지 (링크 없음)
- 누락된 크로스링크

## Log Entry Format

```
## [YYYY-MM-DD] <operation>: <brief description>
- 대상: <source or query>
- 생성/수정: <page list>
- 노트: <anything notable>
```
