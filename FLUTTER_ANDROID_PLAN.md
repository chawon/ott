# Flutter Android Migration Plan (Riverpod + Drift)

## 결정사항
- Target: Android 우선 (iOS 추후)
- 상태관리: Riverpod
- 로컬 DB: Drift
- UI: 모바일 최적화
- 기능 범위: 웹 버전 풀 기능(Agents.md 기준)
- 앱 위치: apps/mobile

## 범위(Full Features)
- TMDB 검색 + 포스터/기본정보 표시
- 기록 저장(QuickLog) + 홈/타임라인 즉시 반영
- TPO(Place/Occasion) + watchedAt 기본값
- 로그 업데이트 + 히스토리 타임라인
- 공개 글감/댓글/멘션
- 페어링 코드 로그인/계정 병합
- 평점 3단계 라벨
- 로컬 우선(Local-first): 캐시/쓰기 + outbox 동기화
- Sync API(pull/push) LWW 정책
- 추천 기능 제외 유지

## 마일스톤
1) 베이스 앱/아키텍처
2) 검색/저장/홈/타임라인
3) 상세/업데이트/히스토리
4) 공개 글감/댓글/멘션
5) 로컬 우선 + 동기화
6) QA/릴리스 준비

## 작업 항목
### 1. 프로젝트 세팅
- Flutter 모듈 생성(안드로이드 타깃)
- 환경설정(dev/prod) 구성
- 패키지 선정 및 추가
  - riverpod / flutter_riverpod
  - drift / drift_flutter / sqlite
  - dio(or http), json_serializable, freezed 등

### 2. 아키텍처 설계
- 폴더 구조 정의 (features, data, domain, presentation)
- 라우팅(go_router) 구성
- API 클라이언트/인터셉터(페어링 코드 인증 헤더)
- 모델/DTO 정의 (웹 lib/types.ts 매핑)

## 진행 현황(요약)
- [x] Flutter Android 앱 스캐폴딩 생성 (`apps/mobile`)
- [x] Riverpod/Drift/Dio/Freezed/JSON 패키지 추가
- [x] 기본 라우팅(go_router) + 하단 탭 네비게이션 구성
- [x] Drift 스키마 기본 테이블 추가 (titles/logs/history/outbox)
- [x] API Base URL 환경변수 + Dio 클라이언트 Provider 추가
- [x] 기본 DTO 정의 (Title, TitleSearchItem, WatchLog, Place/Occasion)
- [x] Title/Log API 레이어 추가
- [x] 로컬 우선(Recent logs) 기본 연결
- [x] 로그 리스트에 Title 조인 표시
- [x] Quick Log 기본 플로우 추가(검색 → 선택 → 저장)
- [x] Quick Log 옵션 UI 추가(TPO/평점/노트/OTT)
- [x] 타임라인 로컬 우선 리스트 연결
- [x] 상세 화면 기본 구현(로그 업데이트 + 히스토리)
- [x] UI 한글화(라벨/탭 타이틀)

### 3. 핵심 화면(MVP)
- 홈: QuickLog + 최근 기록
- 타임라인: 로그 목록 + 필터
- 검색: TMDB 검색 + 선택
- 로그 생성 플로우

### 4. 상세/업데이트/히스토리
- 내 로그 조회 + PATCH 업데이트
- 히스토리 타임라인 표시

### 5. 공개 글감/댓글
- 글감 목록/상세
- 댓글 목록/작성 + 멘션 UI

### 6. 로컬 우선/동기화
- Drift 스키마(titles/logs/history/outbox)
- 로컬 우선 조회/렌더
- outbox 큐 처리 + online/foreground sync
- sync pull/push LWW 정책 반영

### 7. 계정/페어링
- register/pair 플로우
- 계정 병합 처리

### 8. 품질/릴리스
- 핵심 플로우 테스트
- 오프라인/온라인 전환 테스트
- 스토어 준비(아이콘/스플래시/권한)

## 다음 실행 단계(바로 시작)
- Flutter 프로젝트 생성 위치/이름 결정 → apps/mobile
- 패키지 버전 확정
- 기본 폴더 구조 및 빌드 확인
