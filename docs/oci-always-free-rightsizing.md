# OCI Always Free Right-Sizing Review

작성일: 2026-06-15
종료일: 2026-08-03
상태: 종료 — paid 계정 확인으로 강제 축소 불필요
우선순위: 없음

## 종료 결정

OCI 계정이 paid 계정임을 확인했다. 따라서 Always Free 한도에 맞추기 위해 A1 사용량을 `2 OCPU / 12GB RAM`으로 강제 축소할 필요가 없다.

1. DB 인스턴스와 OKE worker node의 축소는 진행하지 않는다.
2. 현재 production 구성을 유지한다.
3. 향후 right-sizing은 무료 한도 대응이 아니라 실제 비용과 사용량을 근거로 별도 결정한다.
4. `2026-06-15`에 완료한 `n8n`·상시 staging 제거와 production 수동 배포 전환은 되돌리지 않는다.

아래 내용은 종료된 검토의 배경과 당시 측정값을 보존한 기록이며 실행 계획이 아니다.

## 검토 당시 목적

OCI Always Free A1 리소스 사용량을 `2 OCPU / 12GB RAM` 안에 맞추면서 production `ottline.app`을 유지할 수 있는지 검토했다.

## 검토 당시 확인된 상태

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

## 취소된 목표 리소스 배치

1차 목표안:

| 리소스 | 현재 | 목표 후보 | 비고 |
|---|---:|---:|---|
| DB instance | `1 OCPU / 6GB` | `1 OCPU / 2GB` | 재부팅 발생. OCI가 허용하는 최소 메모리를 먼저 확인한다. |
| OKE worker node | `3 OCPU / 18GB` | `1 OCPU / 10GB` | 단일 노드라 축소 중 짧은 영향 가능성이 있다. |
| 총합 | `4 OCPU / 24GB` | `2 OCPU / 12GB` | Always Free 축소 대응 목표 |

주의: OKE가 현재 메모리를 8Gi 이상 사용 중이므로 `1 OCPU / 10GB`는 여유가 크지 않다. 리사이즈 후에는 memory pressure, eviction, restart 여부를 반드시 관측한다.

## 취소된 실행안

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

## 당시 추가로 검토한 후보

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

## 유지하는 배포 운영 원칙

상시 staging은 되살리지 않는다. 위험도가 큰 DB migration, 외부 심사, 큰 계약 변경이 있을 때만 임시 staging을 만들고, 검증 후 namespace, ingress, image, DB를 함께 정리한다.

일상 배포는 다음 흐름을 사용한다.

1. feature/fix branch에서 작업
2. PR 생성
3. `Verify Web` / `Verify API` 통과 확인
4. main merge
5. 필요한 경우 production workflow를 main SHA로 수동 실행
6. GitHub Actions, ArgoCD, in-cluster image/`APP_VERSION`으로 확인

## 종료 상태

`2 OCPU / 12GB` 축소 완료 기준은 더 이상 적용하지 않는다. paid 계정 운영이므로 현재 리소스를 유지하며, 비용 또는 용량 문제가 실제로 확인될 때 새 근거와 별도 계획으로 다시 검토한다.
