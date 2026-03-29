# Staging 환경 운영 가이드

## 현재 구조

```
OKE 클러스터
├── namespace: ott          → ottline.app          (프로덕션)
└── namespace: ott-staging  → staging.ottline.app  (스테이징, Cloudflare Access 접근 제한)

PostgreSQL (10.0.20.97:5432)
├── DB: watchlog           (프로덕션)
└── DB: watchlog_staging   (스테이징)

OCIR 이미지 태그 규칙
├── ott-web:staging-{sha}  (스테이징 전용)
├── ott-web:{sha}          (프로덕션 전용)
├── ott-api:staging-{sha}  (스테이징 전용)
└── ott-api:{sha}          (프로덕션 전용)
```

---

## 배포 흐름

```
feature/* ──PR──→ main ──→ [자동] staging 빌드·배포
                                  ↓
                            staging.ottline.app 검증
                                  ↓
                         GitHub Actions → workflow_dispatch
                         (SHA 입력, 프로덕션 빌드·배포)
                                  ↓
                            ottline.app 반영
```

### 스테이징 자동 배포 (main 머지 시)

- 워크플로우: `deploy-web.yml`, `deploy-api.yml`
- 이미지 태그: `staging-{full-sha}`
- 업데이트 대상: `deploy/oke-staging/{web,api}-deployment.yaml`
- 완료 후 워크플로우 **Summary 탭**에 프로덕션 배포용 SHA 출력

### 프로덕션 수동 배포

1. staging 검증 완료
2. GitHub Actions → **Deploy Web/API to Production** → `Run workflow`
3. 입력값 `sha`: 스테이징 배포 워크플로우 Summary에서 복사
4. 새 이미지를 `{sha}` 태그로 빌드 후 `deploy/oke/{web,api}-deployment.yaml` 업데이트
5. ArgoCD가 변경 감지 → 프로덕션 자동 적용

---

## GitOps (ArgoCD)

ArgoCD가 `deploy/oke/`와 `deploy/oke-staging/` 디렉토리를 감시해 `main` HEAD에 자동 동기화한다.
- ArgoCD Application: `deploy/oke-staging/argocd-app.yaml` (self-apply 제외)
- CI가 manifest의 이미지 태그와 `APP_VERSION`을 git commit → ArgoCD가 Kubernetes에 적용

---

## 버전 표시 (Footer)

각 환경의 web/api 버전이 Footer 우하단에 표시된다.

```
web staging-a1b2c3d · api staging-a1b2c3d   (스테이징)
web a1b2c3d · api a1b2c3d                   (프로덕션)
```

- **web 버전**: K8s Deployment의 `APP_VERSION` env → 서버 컴포넌트에서 읽음
- **api 버전**: `BACKEND_URL/actuator/info` 호출 (1시간 캐시)
- CI가 배포 시 `APP_VERSION`을 manifest에 자동으로 `{short-sha}` 형식으로 기록

---

## 인프라 구성

### TLS
Cloudflare Origin Certificate로 관리. cert-manager/Let's Encrypt 사용 안 함.

```bash
kubectl create secret tls staging-ottline-app-tls \
  --cert=origin.crt --key=origin.key -n ott-staging
```

### 시크릿
OCI Vault → ESO → Kubernetes Secret. git에 실제 시크릿 값 커밋 금지.

스테이징 전용 Vault 키: `STAGING_DB_URL`, `STAGING_DB_USER`, `STAGING_DB_PASSWORD`, `STAGING_ADMIN_ANALYTICS_TOKEN`

### 스테이징 접근 제한 (Cloudflare Access)
Cloudflare Zero Trust → Access → Applications → `staging.ottline.app`
이메일 OTP 인증 후 진입. 외부에는 인증 페이지만 노출.

---

## 주의사항

### PostgreSQL 15 public schema 권한
PostgreSQL 15부터 public 스키마 CREATE 권한이 기본 제거됐다.
스테이징 DB 최초 설정 또는 초기화 시 반드시 실행:

```sql
GRANT CREATE ON SCHEMA public TO watchlog_staging;
```

### 환경 구분 식별
- 스테이징: 화면 상단 amber 색 `STAGING` 배너 표시 (`APP_ENV=staging` 런타임 env)
- 프로덕션: 배너 없음

### Telegram 알림
스테이징에서는 비활성화 (`TELEGRAM_NOTIFY_ENABLED: "false"`). Deployment env에 직접 주입.

### registry-secret.yaml
`.dockerconfigjson`이 git에 커밋되어 있음. 추후 ESO 교체 고려.
