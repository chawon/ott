# 설계 문서: 함께(Together) 메뉴 명칭 변경 및 언어별 필터링 도입

## 1. 개요
- **목적**: 영어 버전의 "Community" 메뉴를 한국어 원문 뉘앙스인 "Together"로 변경하고, 언어별로 소통 공간을 분리하여 사용자 경험을 개선함.
- **배경**: 다른 언어권 사용자들이 섞여 있을 경우 원활한 소통이 어렵다는 판단 하에, 로케일 기반의 필터링을 도입하기로 함.

## 2. 변경 범위
### 프론트엔드
- `apps/web/messages/en.json`: "Community" 관련 모든 문구를 "Together"로 변경.
- `apps/web/lib/api.ts`: API 요청 시 `Accept-Language` 헤더에 현재 브라우저의 로케일 정보(`document.documentElement.lang`)를 포함하도록 보장 (기존 로직 활용).

### 백엔드
- **DB 스키마**: `discussions` 테이블에 `locale` (VARCHAR) 컬럼 추가 및 인덱스 생성.
- **엔티티 (`DiscussionEntity`)**: `locale` 필드 추가 및 생성 시 저장 로직 반영.
- **저장소 (`DiscussionRepository`)**: `locale` 필터를 포함한 최신 목록 조회 쿼리(`findLatestIds`) 수정.
- **서비스 (`DiscussionService`)**: 목록 조회 및 토픽 생성 시 로케일 파라미터 처리.
- **컨트롤러 (`DiscussionController`)**: `Accept-Language` 헤더에서 로케일을 추출(`normalizeLocale`)하여 서비스에 전달.

## 3. 상세 설계
### 로케일 정규화 (Normalization)
- `Accept-Language` 헤더(`ko-KR,ko;q=0.9...`)에서 가장 우선순위가 높은 언어 코드(`ko`, `en` 등)만 추출하여 2자리 소문자로 관리.

### 데이터 마이그레이션
- 기존 `discussions` 데이터는 기본값인 `ko`로 일괄 설정.

## 4. 검증 시나리오
1. **메뉴 명칭 확인**: 영어 환경 접속 시 헤더/푸터/홈페이지 섹션 타이틀이 "Together"로 표시되는지 확인.
2. **언어별 필터링 확인**:
   - `ko` 환경에서 작성된 댓글/공유글은 `en` 환경의 목록에 노출되지 않아야 함.
   - 반대로 `en` 환경에서 작성된 글은 `ko` 환경에서 노출되지 않아야 함.
3. **토픽 생성 확인**: 새로운 댓글을 작성할 때, 해당 유저의 현재 언어 설정에 맞춰 `discussions` 테이블의 `locale` 컬럼이 올바르게 저장되는지 확인.

## 5. 결과
- 메뉴 명칭 변경 완료.
- 백엔드 필터링 로직 및 DB 마이그레이션(`V21`) 적용 완료.
