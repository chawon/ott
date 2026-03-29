# Staging 환경 구성 계획

## 개요

현재 OKE 클러스터에 프로덕션 환경(`ott` 네임스페이스)만 운영 중이다.
같은 클러스터 내에 `ott-staging` 네임스페이스를 추가하여 테스트 환경을 별도 구성한다.

## 현재 구조

```
OKE 클러스터
└── namespace: ott (프로덕션)
    ├── Deployment: ott-api
    ├── Deployment: ott-web
    ├── Service: ott-api
    ├── Service: ott-web
    ├── Ingress: ott-ingress → ottline.app, ott.preview.pe.kr
    ├── ExternalSecret: ott-api-secrets (← OCI Vault)
    └── ServiceAccount: ott-api (RBAC)

PostgreSQL (10.0.20.97:5432)
└── DB: watchlog (프로덕션)
```

## 목표 구조

```
OKE 클러스터
├── namespace: ott (프로덕션)
│   └── → ottline.app
└── namespace: ott-staging (스테이징)
    └── → staging.ottline.app (Cloudflare Access로 접근 제한)

PostgreSQL (10.0.20.97:5432)
├── DB: watchlog           (프로덕션)
└── DB: watchlog_staging   (스테이징)
```

---

## 개발·배포 전략

### 브랜치 전략

혼자 개발하므로 단순하게 유지한다.

```
feature/* ──→ main ──→ 자동 배포 → staging.ottline.app (검증)
                              ↓
                         수동 승인 (workflow_dispatch)
                              ↓
                         ottline.app (프로덕션)
```

| 브랜치 | 용도 | 직접 푸시 |
|---|---|---|
| `main` | 스테이징 자동 배포 트리거 | PR만 |
| `feature/*` | 기능 개발 | ✅ |
| `fix/*` | 버그 수정 | ✅ |
| `hotfix/*` | 긴급 수정 (스테이징 생략 가능) | ✅ |

### 워크플로우

```
1. feature/* 브랜치 생성
2. 개발 및 로컬 확인
3. main으로 PR 머지
4. GitHub Actions → 스테이징 자동 배포
5. staging.ottline.app 에서 검증
6. GitHub Actions → 프로덕션 수동 트리거 (workflow_dispatch)
```

### 프로덕션 배포 트리거

GitHub Actions 탭 → `Deploy Web to OKE (Production)` → `Run workflow`

---

## 스테이징 접근 제한 (Cloudflare Access)

`staging.ottline.app`은 외부에 공개되지 않도록 Cloudflare Zero Trust로 보호한다.

### 설정 방법

1. Cloudflare 대시보드 → **Zero Trust → Access → Applications**
2. **Add Application → Self-hosted**
3. Application domain: `staging.ottline.app`
4. Policy: 허용 이메일 직접 지정 (Emails 조건)
5. 저장

접속 시 이메일 OTP 인증 후 진입. 외부에서는 인증 페이지만 노출된다.

---

## 1. DB 분리

같은 PostgreSQL 서버(10.0.20.97)에 `watchlog_staging` 데이터베이스를 별도 생성한다.
Flyway가 앱 시작 시 자동으로 마이그레이션을 적용하므로 스키마는 자동 구성된다.

### 초기 DB 설정 (DBA 작업)

```sql
CREATE DATABASE watchlog_staging;
CREATE USER watchlog_staging WITH PASSWORD '<password>';
GRANT ALL PRIVILEGES ON DATABASE watchlog_staging TO watchlog_staging;
```

---

## 2. OCI Vault 시크릿 추가

프로덕션과 같은 Vault에 스테이징 전용 시크릿을 추가한다.

| Vault 키 | 값 |
|---|---|
| `STAGING_DB_URL` | `jdbc:postgresql://10.0.20.97:5432/watchlog_staging` |
| `STAGING_DB_USER` | `watchlog_staging` |
| `STAGING_DB_PASSWORD` | `<password>` |
| `STAGING_ADMIN_ANALYTICS_TOKEN` | `staging` |

> `TMDB_ACCESS_TOKEN`, `NAVER_CLIENT_ID/SECRET`, `CF_*`, `GA4_*` 등은
> 프로덕션과 동일한 키를 그대로 참조한다.

---

## 3. OKE 매니페스트 (`deploy/oke-staging/`)

### `namespace.yaml`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ott-staging
```

### `registry-secret.yaml`

프로덕션 `deploy/oke/registry-secret.yaml`과 동일한 내용, namespace만 `ott-staging`.

### `external-secret.yaml`

프로덕션과 같은 OCI Vault를 참조하되 DB 관련 키만 스테이징 전용으로 교체한다.

```yaml
apiVersion: external-secrets.io/v1
kind: SecretStore
metadata:
  name: oci-vault-store
  namespace: ott-staging
spec:
  provider:
    oracle:
      vault: ocid1.vault.oc1.ap-chuncheon-1.gju4rwlyaactq.ab4w4ljrq6aokzb5yl3ofvmjtphfwyulzdsksw2wujzyxi2gfv23zed6hlaq
      region: ap-chuncheon-1
---
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: ott-api-secrets
  namespace: ott-staging
spec:
  refreshInterval: "1h"
  secretStoreRef:
    name: oci-vault-store
    kind: SecretStore
  target:
    name: ott-api-secrets
    creationPolicy: Owner
  data:
    - secretKey: DB_URL
      remoteRef:
        key: STAGING_DB_URL
    - secretKey: DB_USER
      remoteRef:
        key: STAGING_DB_USER
    - secretKey: DB_PASSWORD
      remoteRef:
        key: STAGING_DB_PASSWORD
    - secretKey: TMDB_ACCESS_TOKEN
      remoteRef:
        key: TMDB_ACCESS_TOKEN
    - secretKey: NAVER_CLIENT_ID
      remoteRef:
        key: NAVER_CLIENT_ID
    - secretKey: NAVER_CLIENT_SECRET
      remoteRef:
        key: NAVER_CLIENT_SECRET
    - secretKey: ADMIN_ANALYTICS_TOKEN
      remoteRef:
        key: STAGING_ADMIN_ANALYTICS_TOKEN
    - secretKey: CF_API_TOKEN
      remoteRef:
        key: CF_API_TOKEN
    - secretKey: CF_ZONE_ID
      remoteRef:
        key: CF_ZONE_ID
    - secretKey: CF_ACCOUNT_TAG
      remoteRef:
        key: CF_ACCOUNT_TAG
    - secretKey: GA4_PROPERTY_ID
      remoteRef:
        key: GA4_PROPERTY_ID
    - secretKey: GA4_CREDENTIALS_JSON
      remoteRef:
        key: GA4_CREDENTIALS_JSON
```

> `TELEGRAM_*`는 스테이징에서 불필요하므로 포함하지 않는다.
> 컨테이너 env에서 `TELEGRAM_NOTIFY_ENABLED: "false"`를 직접 주입한다.

### `web-config.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ott-web-config
  namespace: ott-staging
data:
  BACKEND_URL: http://ott-api:8080
```

### `report-rbac.yaml`

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ott-api
  namespace: ott-staging
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ott-api-report-reader
  namespace: ott-staging
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list"]
  - apiGroups: ["metrics.k8s.io"]
    resources: ["pods"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ott-api-report-reader-binding
  namespace: ott-staging
subjects:
  - kind: ServiceAccount
    name: ott-api
    namespace: ott-staging
roleRef:
  kind: Role
  name: ott-api-report-reader
  apiGroup: rbac.authorization.k8s.io
```

### `api-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ott-api
  namespace: ott-staging
spec:
  replicas: 1
  revisionHistoryLimit: 2
  selector:
    matchLabels:
      app: ott-api
  template:
    metadata:
      labels:
        app: ott-api
    spec:
      serviceAccountName: ott-api
      imagePullSecrets:
        - name: ocir-pull-secret
      containers:
        - name: api
          image: yny.ocir.io/axvqyylkrvmi/ott-api:latest
          ports:
            - containerPort: 8080
          env:
            - name: TELEGRAM_NOTIFY_ENABLED
              value: "false"
            - name: TELEGRAM_SERVICE_NAME
              value: "ottline-staging"
            - name: CF_REQUEST_HOST
              value: "staging.ottline.app"
          envFrom:
            - secretRef:
                name: ott-api-secrets
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: ott-api
  namespace: ott-staging
spec:
  selector:
    app: ott-api
  ports:
    - name: http
      port: 8080
      targetPort: 8080
```

### `web-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ott-web
  namespace: ott-staging
spec:
  replicas: 1
  revisionHistoryLimit: 2
  selector:
    matchLabels:
      app: ott-web
  template:
    metadata:
      labels:
        app: ott-web
    spec:
      imagePullSecrets:
        - name: ocir-pull-secret
      containers:
        - name: web
          image: yny.ocir.io/axvqyylkrvmi/ott-web:latest
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: ott-web-config
            - secretRef:
                name: ott-api-secrets
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: ott-web
  namespace: ott-staging
spec:
  selector:
    app: ott-web
  ports:
    - name: http
      port: 3000
      targetPort: 3000
```

### `ingress.yaml`

TLS는 Cloudflare Origin Certificate로 관리한다.
`staging-ottline-app-tls` Secret은 CF에서 발급한 Origin Certificate를 수동으로 등록한다.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ott-ingress
  namespace: ott-staging
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
spec:
  tls:
    - hosts:
        - staging.ottline.app
      secretName: staging-ottline-app-tls
  rules:
    - host: staging.ottline.app
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: ott-api
                port:
                  number: 8080
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ott-web
                port:
                  number: 3000
```

---

## 4. TLS (Cloudflare Origin Certificate)

### 발급 절차

1. Cloudflare 대시보드 → `ottline.app` 존 → **SSL/TLS > Origin Server**
2. **Create Certificate** → `staging.ottline.app` 호스트명 → 발급
3. K8s Secret 생성:

```bash
kubectl create secret tls staging-ottline-app-tls \
  --cert=origin.crt \
  --key=origin.key \
  -n ott-staging
```

### DNS 설정

Cloudflare DNS에서 `staging.ottline.app` → OKE Ingress IP (A 레코드, Proxied).

---

## 5. GitHub Actions 워크플로우

### 스테이징 자동 배포 (`main` 머지 시)

기존 `deploy-api.yml`, `deploy-web.yml`을 스테이징 배포용으로 전환한다.
이미지를 빌드하고 `deploy/oke-staging/` 매니페스트를 업데이트한다.

워크플로우 파일명: `deploy-api-staging.yml`, `deploy-web-staging.yml`
- 트리거: `main` 브랜치 push
- 이미지 태그: `staging-${{ github.sha }}`
- 업데이트 대상: `deploy/oke-staging/{api,web}-deployment.yaml`

### 프로덕션 수동 배포 (`workflow_dispatch`)

워크플로우 파일명: `deploy-api-production.yml`, `deploy-web-production.yml`
- 트리거: `workflow_dispatch` (수동)
- 입력값: 배포할 이미지 태그 (스테이징에서 검증된 `staging-{sha}`)
- 업데이트 대상: `deploy/oke/{api,web}-deployment.yaml`

---

## 6. 구현 순서

1. **DB 준비**: PostgreSQL에서 `watchlog_staging` DB 및 유저 생성
2. **OCI Vault 시크릿 추가**: `STAGING_*` 키 4개 등록
3. **TLS 발급**: Cloudflare Origin Certificate → `staging-ottline-app-tls` Secret 생성
4. **DNS 등록**: Cloudflare에서 `staging.ottline.app` A 레코드 추가 (Proxied)
5. **Cloudflare Access 설정**: `staging.ottline.app` 접근 제한
6. **매니페스트 작성**: `deploy/oke-staging/` 파일 생성
7. **초기 배포**: `kubectl apply -f deploy/oke-staging/`
8. **접속 확인**: `staging.ottline.app` 정상 응답 확인
9. **워크플로우 재편**: 스테이징 자동 + 프로덕션 수동 워크플로우로 분리

---

## 주의사항

- 시크릿은 절대 git에 실제 값으로 커밋하지 않는다. 모든 시크릿은 OCI Vault → ESO 경유.
- `registry-secret.yaml`의 `.dockerconfigjson`은 git에 커밋되어 있으므로 주의. 추후 ESO 교체 고려.
- 스테이징 DB는 프로덕션 데이터와 완전히 분리된다.
- Telegram 알림은 스테이징에서 비활성화 (`TELEGRAM_NOTIFY_ENABLED: "false"`).
