# Web/API 의존성 통합 반영 — 2026-10-10

## 범위

사용자의 운영 반영 승인에 따라 준비한 Web 5개 단계(#110, #112, #114, #115, #116)와 API 3개 단계(#111, #113, #117)를 최신 main에서 만든 통합 브랜치로 합친다. 개별 단계의 CI에 더해 같은 통합 커밋에서 Web/API ARM64 CI를 실행한다.

- Web: Next.js 16.3.8, React 19.3.0, sharp 0.35.5, next-intl 4.14.9, 일반 라이브러리 17개, lucide-react 1.54.0, fast-average-color-node 4.0.0, MCP Apps 2.0.3 및 SDK 2.3.1, TypeScript 7.0.2.
- API: Spring Boot 4.1.1, Hibernate 7.4.5.Final, Flyway 12.4.0, Testcontainers 2.0.5, Google Auth 1.54.0, Gradle 9.8.1, GraalVM Native Build Tools 1.1.14. Java 25 JVM 이미지로 실행한다.
- API 계약과 DB migration 파일은 변경하지 않는다. 기존 생성·수정·히스토리·커서·동기화 계약을 검증한다.
- ChatGPT App은 심사 탈락 후 서비스하지 않는 상태다. SDK 유지보수만 반영하며 재제출이나 서비스 개시는 포함하지 않는다.
- iOS 네이티브 manifest와 바이너리는 변경하지 않는다. 원래 작업트리의 Netflix 가져오기 개발 변경도 포함하지 않는다.

단계별 범위와 검증 증거는 [업데이트 목록](dependency-updates.md) 및 연결된 문서에 기록한다.

## 통합 검증과 배포 절차

1. 통합 PR의 Web/API ARM64 CI를 확인한다. Web은 TypeScript 컴파일러·Next 플러그인, 단위 테스트, 운영 이미지 버전, 공유 카드 PNG, MCP HTTP, 한국어·영어 전환, 타임라인과 오프라인 저장 복구를 검증한다.
2. API는 Java 25에서 PostgreSQL 테스트 87개가 skip 없이 실행되는지 확인하고, 새 DB와 Spring Boot 4.0.8 DB의 새 이미지 전환·재시작·기록 보존을 검증한다.
3. main에 merge commit으로 반영하고 확정 SHA로 API를 먼저 수동 배포한다. API 이미지·버전·ready 및 실제 조회 계약을 확인한 뒤 같은 SHA로 Web을 배포한다.
4. ArgoCD `Synced Healthy`, 두 이미지 태그와 `APP_VERSION`, Pod 준비·재시작 상태를 확인한다. 운영 API 조회, 웹 프록시, 한국어·영어 HTML 및 실제 공유 PNG를 점검한다.
5. 운영 확인 결과와 workflow/manifest 커밋을 이 문서, AGENTS.md, wiki에 기록한다.

Native iOS CI의 Expo doctor에는 기존 9개 Expo 패키지의 패치 버전 차이가 남아 있다. 타입 검사와 Jest 27개는 통과하며, 통합 CI에서도 실패 항목이 기존 기준과 같은지 비교한다. 이 상태를 숨기거나 검사에서 제외하지 않는다.

## 복구 기준

반영 전 API/Web의 정상 운영 이미지 태그는 모두 `01ef6b9b5b018970006ab6f42118b46824fb3430`이다. readiness 실패, 새 서버 오류, 조회·동기화 계약 이상 또는 공유 PNG 렌더 실패가 발생하면 다음 배포를 멈추고 원인을 확인한다. 현재 DB migration 변경이 없으므로 복구가 필요하면 GitOps manifest에서 해당 서비스의 이미지와 `APP_VERSION`을 이전 정상 값으로 되돌린 뒤 ArgoCD와 실제 기능을 다시 확인한다.

## 반영 상태

통합 브랜치 구성 완료. 통합 CI와 운영 배포 결과를 확인한 뒤 확정 증거를 추가한다.
