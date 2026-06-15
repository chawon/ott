# OCI Always Free Right-Sizing Plan

작성일: 2026-06-15
우선순위: P0

## 목적

OCI Always Free A1 리소스 사용량을 `2 OCPU / 12GB RAM` 안에 맞춘다. 제품 운영에 필요한 production `ottline.app`은 유지하고, 상시 staging과 명확히 불필요한 workload는 제거한다.

## 현재 확인된 상태

2026-06-15 점검 기준:

| 영역 | 리소스 | 상태 |
|---|---|---|
| Compute DB | `db` instance | `VM.Standard.A1.Flex`, `1 OCPU / 6GB` |
| OKE node | `oke-a1-3ocpu` node pool worker | `VM.Standard.A1.Flex`, `3 OCPU / 18GB` |
| 총 A1 사용량 | DB + OKE | `4 OCPU / 24GB` |
| Load Balancer | flexible LB | `10Mbps`, 1개 |
| Storage | boot/block volumes | 약 `144GB`, Always Free 200GB 한도 안 |

DB 최근 7일 관측값은 CPU가 대체로 `1-3%`, 메모리가 약 `13-15.5%` 수준이었다. 따라서 DB는 OKE보다 먼저 축소 후보로 본다.

## 이미 완료한 정리

`2026-06-15`에 아래 항목을 완료했다.

1. `n8n` namespace 삭제
2. 상시 staging 종료
   - `ott-staging-app` ArgoCD Application 삭제
   - `ott-staging` namespace 삭제
   - `staging.ottline.app` ingress 제거
   - `deploy/oke-staging/*` manifest 삭제
3. 배포 전략 변경
   - main merge 후 상시 staging 자동 배포 없음
   - PR/main에서는 `Verify Web`, `Verify API`로 빌드와 컨테이너 빌드만 검증
   - production은 `Deploy Web to Production`, `Deploy API to Production` workflow를 수동 실행
   - production 배포 입력값은 검증 완료된 main SHA
4. PR `#61` 병합
   - main SHA: `f039042b7c23ee8bd18a2a14be9f7c22ef73c9e7`
   - main `Verify Web`, `Verify API` 성공
   - ArgoCD `ott-app`은 `Synced Healthy`

정리 직후 노드 사용량은 대략 CPU `235m`, 메모리 `8213Mi`였다. 이 값은 시점별 부하에 따라 달라질 수 있으므로 리사이즈 직전 다시 확인한다.

## 목표 리소스 배치

1차 목표안:

| 리소스 | 현재 | 목표 후보 | 비고 |
|---|---:|---:|---|
| DB instance | `1 OCPU / 6GB` | `1 OCPU / 2GB` | 재부팅 발생. OCI가 허용하는 최소 메모리를 먼저 확인한다. |
| OKE worker node | `3 OCPU / 18GB` | `1 OCPU / 10GB` | 단일 노드라 축소 중 짧은 영향 가능성이 있다. |
| 총합 | `4 OCPU / 24GB` | `2 OCPU / 12GB` | Always Free 축소 대응 목표 |

주의: OKE가 현재 메모리를 8Gi 이상 사용 중이므로 `1 OCPU / 10GB`는 여유가 크지 않다. 리사이즈 후에는 memory pressure, eviction, restart 여부를 반드시 관측한다.

## 실행 순서

1. 리사이즈 전 현재 상태 재확인
   - OCI Compute instance shape config
   - OKE node pool shape config
   - `kubectl top node`
   - `kubectl top pods -A`
   - ArgoCD `ott-app` 상태
2. DB 백업/복구 지점 확보
   - DB 인스턴스 boot volume 백업 또는 현재 운영 백업 상태 확인
   - 점검 시간 확보
3. DB 인스턴스 축소
   - 목표: `1 OCPU / 2GB`부터 검토
   - 축소 후 API 연결, DB CPU/memory, disk, application error 확인
4. OKE node pool 축소
   - 목표: `1 OCPU / 10GB`부터 검토
   - 축소 전 production pod readiness와 PDB/재스케줄링 가능성 확인
   - 축소 후 `ott-web`, `ott-api`, ingress, ArgoCD 상태 확인
5. 24시간 관측
   - node memory pressure
   - pod restart/eviction
   - API latency/error
   - DB CPU/memory

## 축소 후에도 부족하면 볼 후보

아래 항목은 production 영향과 소유 여부를 확인한 뒤 판단한다.

1. `wp` namespace
   - `wp-wordpress`와 `50Gi` PVC 사용 중
   - 유지 필요성이 낮으면 별도 백업 후 제거 후보
2. `web` namespace
   - `hp-site`, `me-site` 운영 필요성 확인
3. ArgoCD 경량화
   - 운영 편의성과 GitOps 자동화를 포기해야 하므로 최후순위
4. OCIR 이미지 정리
   - 상시 staging이 종료되어 신규 `staging-*` 이미지는 더 이상 생성되지 않는다.
   - live reference가 없는 과거 staging image tag는 별도 확인 후 삭제 가능

## 변경 후 배포 운영 원칙

상시 staging은 되살리지 않는다. 위험도가 큰 DB migration, 외부 심사, 큰 계약 변경이 있을 때만 임시 staging을 만들고, 검증 후 namespace, ingress, image, DB를 함께 정리한다.

일상 배포는 다음 흐름을 사용한다.

1. feature/fix branch에서 작업
2. PR 생성
3. `Verify Web` / `Verify API` 통과 확인
4. main merge
5. 필요한 경우 production workflow를 main SHA로 수동 실행
6. GitHub Actions, ArgoCD, in-cluster image/`APP_VERSION`으로 확인

## 완료 기준

P0 완료 기준은 아래 조건을 모두 만족하는 것이다.

1. OCI A1 총 사용량이 `2 OCPU / 12GB` 안에 들어온다.
2. `ottline.app` production web/API가 정상이다.
3. DB 연결과 API 주요 쓰기/읽기 흐름이 정상이다.
4. ArgoCD `ott-app`이 `Synced Healthy`다.
5. 축소 후 최소 24시간 동안 memory pressure, pod eviction, 반복 restart가 없다.
