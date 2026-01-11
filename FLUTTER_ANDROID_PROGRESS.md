# Flutter Android Progress

## 2026-01-11
- 브랜치 생성: feature/flutter-android
- Flutter SDK (ARM64) 설치 및 WSL 환경 변수 우회 가이드 작성
- Android 전용 Flutter 앱 스캐폴딩 생성: apps/mobile
- Riverpod/Drift/Dio/Freezed/JSON 의존성 추가
- 기본 앱 구조 구성
  - Material 3 테마
  - GoRouter 기반 탭 네비게이션(홈/타임라인/공개/계정)
  - 기본 페이지 스켈레톤 구성
- Drift 스키마 기본 설계(titles/logs/history/outbox) 추가
- DB Provider(Riverpod) 추가
- API Base URL 환경변수 지원 추가(`API_BASE_URL`)
- Dio 클라이언트 Provider 추가
- 기본 DTO 추가(Title, TitleSearchItem, WatchLog, Place/Occasion)
- build_runner 실행(Freezed/JSON/Drift 코드 생성)
- API 레이어 추가(Title/Search, Logs fetch/create)
- 로컬 우선 흐름 기본 구현(홈에서 로컬 스트림 + 원격 refresh)
- 타이틀 조인(로그에 titleId → title name 표시)
- 검색 → 선택 → 로그 생성(Quick Log) 기본 플로우 추가
- Quick Log 옵션 UI 추가(상태/평점/OTT/노트/TPO)
- 타임라인 화면 로컬 우선 리스트 연결
- 상세 화면 기본 구현(타이틀/내 로그 업데이트/히스토리)
- 상세 업데이트 후 히스토리 자동 리프레시
- UI 한글화(라벨/옵션/탭 타이틀)
- Android 네트워크 권한/HTTP 허용 설정 추가
- 타이틀 검색 결과 로컬 캐시 저장 추가
- 오프라인 검색(로컬 캐시) 폴백 추가
- GitHub Actions Android Debug APK 워크플로 추가

## 다음 작업
- 로컬 우선 데이터 흐름(Drift + Remote 병합)
- 홈/타임라인 기본 데이터 흐름(로컬 우선)
- Drift 코드 생성(build_runner) 및 마이그레이션 전략 확정
- Analyzer 버전 경고 해결(필요 시 패키지 업그레이드)
- 타이틀 캐시/검색 연동(검색 결과 → 저장 시 로컬에 title upsert)
- Quick Log 옵션(TPO/평점/노트/OTT) UI 추가
