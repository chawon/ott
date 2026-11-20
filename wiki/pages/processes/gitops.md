# GitOps 운영

Web·API는 OCI OKE의 `ott` namespace에서 실행된다. Argo CD의 `ott-app`이 main의 [deploy/oke](../../../deploy/oke) 매니페스트를 동기화한다. Web/API 이미지는 ARM64용으로 빌드한다.

| 작업 | 워크플로우 |
| --- | --- |
| PR/main 코드 검증 | [Verify Web](../../../.github/workflows/deploy-web.yml) · [Verify API](../../../.github/workflows/deploy-api.yml) |
| 운영 이미지 게시 | [Deploy Web to Production](../../../.github/workflows/deploy-web-production.yml) · [Deploy API to Production](../../../.github/workflows/deploy-api-production.yml) |
| GitOps 설정 적용 | `deploy/oke/`가 main에 반영되면 Argo CD가 동기화한다. |

운영 워크플로우는 입력한 main SHA로 이미지를 빌드한 뒤 태그를 운영 매니페스트에 기록한다. API 변경이 필요한 Web 기능은 API → 실제 API 확인 → 동일 SHA의 Web 순서로 적용한다. 배포 확인에는 이미지·`APP_VERSION`, Argo CD 상태, Pod와 실제 기능을 포함한다. [배포 운영 절차](../../../docs/staging-environment-plan.md)

API 시크릿은 OCI Vault와 External Secrets Operator에서 관리한다. 운영 상태와 로그를 확인할 때 값은 출력하지 않는다. 매니페스트 롤백과 DB 복구의 범위를 각각 확인한다. [GitOps 상세 가이드](../../../docs/GitOps_Guide.md) · [보안 대응](security.md)
