# 도메인 마이그레이션 결과 보고서 (Redirect Flow)

## 1. 개요
- **목적**: `ott.preview.pe.kr`에서 `ottline.app`으로 서비스 도메인을 이전하며, 브라우저 보안 정책(Storage Partitioning)을 우회하여 사용자의 인증 정보를 안전하게 이식함.
- **방식**: 네비게이션 기반 리다이렉트 (Redirect Flow)
- **현재 상태 (`2026-04-18`)**: Cloudflare에서 `ott.preview.pe.kr/* -> https://ottline.app/*` 301 리다이렉트를 적용했고, 웹앱의 MigrationBanner/자동 이사 UI는 운영 종료했다.

## 2. 구현 상세
### 2.1. 마이그레이션 트리거 (`MigrationBanner.tsx`, 운영 종료)
- **구 도메인 전용**: `ott.preview.pe.kr` 호스트에서만 노출.
- **데이터 추출**: `localStorage`의 `userId`, `deviceId`, `pairingCode`를 읽음.
- **리다이렉트**: 
  - 일반 웹: `window.location.href`로 신규 도메인 이동.
  - PWA: `window.open`을 통해 외부 브라우저에서 신규 도메인을 열도록 유도하여 PWA Scope 제한 해결.

### 2.2. 데이터 수신 및 저장 (`migration-helper/page.tsx`, 운영 종료)
- **URL 파라미터**: `u`, `d`, `p` 쿼리 스트링을 통해 데이터 수신.
- **저장 및 알림**: `localStore`에 저장 후 `watchlog.migration-success` 플래그 설정.
- **자동 이동**: 저장 완료 후 홈(`/`)으로 리다이렉트.

### 2.3. 이사 완료 안내 (`MigrationBanner.tsx` 보강, 운영 종료)
- **성공 모드**: 신규 도메인에서 `migration-success` 플래그 감지 시 초록색 축하 배너 노출.
- **PWA 안내**: 새로운 앱 설치 권장 및 기존 앱 삭제 가이드 제공.

## 3. 기술적 해결 사항
- **CORS 설정**: 백엔드(`WebConfig.java`)에서 `ottline.app` 도메인을 명시적으로 허용하여 API 호출 정상화.
- **Ingress/TLS 이력**: 구 도메인과 신규 도메인의 TLS 설정을 각각 유지해 병행 운영 가능한 상태를 만들었고, 최종 컷오버는 Cloudflare 301로 마무리했다.

## 4. 현재 운영 메모
- old domain 직접 서빙은 종료했고, canonical 진입점은 `https://ottline.app` 하나로 정리했다.
- `migration_complete`와 `oldDomainUsage` 지표는 과거 이전 운영 이력과 컷오버 이후 잔존 유입 관측용으로 유지한다.
