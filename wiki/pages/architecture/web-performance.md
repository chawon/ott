# 웹 성능 (Web Performance)

> Cloudflare Web Analytics 기준 Core Web Vitals 현황과 CLS 대응 기록

## 관련 페이지
- [[pwa]]
- [[design-review]]
- [[analytics]]

---

## 2026-04-14 Cloudflare 확인 결과

**근거 자료:** `Account Analytics _ ottline.app _ Cloudflare.pdf`

### Core Web Vitals 요약

| 지표 | 값 | 해석 |
|---|---|---|
| LCP P50 | 792ms | 양호 |
| LCP P75 | 1,240ms | 양호 |
| LCP P90 | 2,948ms | 경계선 근처 |
| INP | 100% good | 반응성 문제는 크지 않음 |
| CLS P50 | 0.306 | 나쁨 |
| CLS P75 | 1.19 | 매우 나쁨 |
| CLS P90 | 1.19 | 매우 나쁨 |
| CLS P99 | 1.19 | 매우 나쁨 |

### Cloudflare가 지목한 주요 CLS 원인

- 요소: `footer.mt-20.border-t.py-12.border-border.bg-muted/60.dark:bg-card/80`
- 페이지 샘플: `/timeline`
- 관찰된 패턴:
  - footer의 이전 layout box가 존재하다가
  - 현재 상태에서 `{ width: 0, height: 0 }`로 사라지는 케이스가 기록됨
- 해석:
  - 단순한 미세 이동보다 footer remount 또는 제거에 가까운 현상으로 보임

---

## 2026-04-14 1차 대응

### 조치 내용

- `apps/web/components/AppFooter.tsx`에서 `apiVersion` 런타임 fetch 제거
- footer 하단의 `web {sha} · api {sha}` 버전 라인 제거
- 결과적으로 footer를 정적 렌더 구조로 단순화

### 배경

- 기존 footer는 `BACKEND_URL/actuator/info`를 호출해 `apiVersion`을 가져왔음
- Cloudflare PDF가 정확히 footer 클래스를 CLS 원인으로 지목했기 때문에
  가장 먼저 footer의 동적 요인을 제거하는 대응을 선택함

### 배포 이력

- PR: `#5` (`Remove footer api version fetch`)
- main merge: 2026-04-14
- staging web 배포 성공 후 동일 SHA로 production web 배포 완료

---

## 현재 판단

1. 1차 원인 후보였던 footer 동적 fetch는 제거됨
2. 배포 후 Cloudflare CLS 지표가 실제로 내려가는지 재관측 필요
3. 여전히 높게 유지되면 다음 후보를 점검

### 다음 후보

1. 홈/타임라인의 클라이언트 후행 렌더 (`useEffect` 이후 목록/영역 확장)
2. 외부 폰트 `@import` 로딩에 따른 텍스트 reflow
3. soft navigation 중 특정 layout 영역 remount 여부

---

## 다음 액션

1. production 반영 후 Cloudflare에서 CLS 재확인
2. 필요 시 `web-vitals` 실측 수집 추가
3. 폰트 로딩을 `next/font` 기반으로 전환 검토
