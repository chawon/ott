# 개발 계획: 구 도메인 잔존 사용 지표 분리

> **브랜치**: `feature/admin-old-domain-analytics`
> **기준일**: 2026-04-16
> **영향 범위**: 백엔드(AnalyticsService, DTO) + 프론트(admin/analytics) + 위키(analytics)

---

## 목표

- `ott.preview.pe.kr` 유입을 단순 `app_open` 총량이 아니라 **실사용 액션 기준**으로 해석할 수 있게 한다.
- 관리자 analytics 페이지에 구 도메인 전용 섹션을 추가한다.
- 301 전환 판단 시 참고할 기준을 UI와 문서에 함께 명시한다.

---

## 문제 정의

현재 `app_open` 이벤트는 클라이언트에서 `window.location.hostname`을 그대로 수집한다.
따라서 구 도메인을 계속 서빙하는 동안에는 배너 확인, 링크 유입, 재방문만으로도 `ott.preview.pe.kr`의 `app_open`이 계속 쌓인다.

이 상태에서 `app_open`만 보면:

- 아직 잔존 사용자가 많은 것처럼 보일 수 있고
- 실제로는 **로그인/기록 생성 같은 실사용은 거의 끝났는지** 판단하기 어렵다.

---

## 판단 기준

### 계속 볼 지표

- `oldDomain.appOpenUsers`
  - 의미: 구 도메인을 실제로 연 actor 수
  - 용도: 잔존 유입 규모 확인

### 컷오버 판단 핵심 지표

- `oldDomain.loginSuccessUsers`
  - 의미: 구 도메인에서 새 기기 연결/로그인까지 간 actor 수
- `oldDomain.logCreateUsers`
  - 의미: 구 도메인에서 실제 기록 생성까지 한 actor 수
- `oldDomain.shareActionUsers`
  - 의미: 구 도메인에서 공유 액션까지 수행한 actor 수
- `oldDomain.knownUsers`
  - 의미: 구 도메인에서 `user_id`가 있는 이벤트를 남긴 고유 사용자 수
- `oldDomain.userBoundEvents`
  - 의미: 구 도메인에서 `user_id`가 채워진 전체 이벤트 수

### 해석 보조 지표

- `oldDomain.lastSeenAt`
  - 의미: 구 도메인에서 마지막 이벤트가 들어온 시각
- `oldDomain.lastMeaningfulActionAt`
  - 의미: 구 도메인에서 마지막 `login_success` / `log_create` / `share_action` 시각
- `oldDomain.installStates`
  - 의미: browser / pwa_installed / twa 분포
- `oldDomain.browserFamilies`
  - 의미: 어떤 브라우저/환경에서 아직 남아 있는지 확인

---

## API 변경

기존 `GET /api/admin/analytics/overview` 응답에 아래 필드를 추가한다.

```json
{
  "oldDomainUsage": {
    "hostname": "ott.preview.pe.kr",
    "appOpenUsers": 35,
    "loginSuccessUsers": 0,
    "logCreateUsers": 0,
    "shareActionUsers": 0,
    "knownUsers": 0,
    "userBoundEvents": 0,
    "lastSeenAt": "2026-04-15T23:54:30.952Z",
    "lastMeaningfulActionAt": null,
    "installStates": [
      { "key": "browser", "events": 33, "activeUsers": 33 }
    ],
    "browserFamilies": [
      { "key": "unknown", "events": 27, "activeUsers": 27 }
    ]
  }
}
```

---

## UI 변경

`/[locale]/admin/analytics`에 `구 도메인 잔존 사용` 섹션을 추가한다.

표시 항목:

1. 카드
   - app_open 유입 수
   - known user 수
   - login_success 수
   - log_create 수
   - share_action 수
2. 최근 시각
   - 마지막 유입 시각
   - 마지막 실사용 액션 시각
3. 세그먼트
   - install_state
   - browser_family
4. 해석 안내
   - `app_open`은 단순 방문 포함
   - 301 전환 판단은 `login_success`, `log_create`, `share_action`, `known user` 위주로 본다

---

## 검증 시나리오

1. `GET /api/admin/analytics/overview?days=7` 응답에 `oldDomainUsage`가 포함된다.
2. old domain에 실사용 이벤트가 없을 때 `lastMeaningfulActionAt`이 `null`로 반환된다.
3. admin analytics 페이지에 새 섹션이 렌더링된다.
4. days 파라미터를 바꾸면 old-domain 카드 수치도 같은 기간 기준으로 바뀐다.
5. 기존 overview, migration status, recent events 섹션은 회귀 없이 그대로 동작한다.

---

## 완료 기준

- [ ] overview 응답에 old domain 실사용 집계 추가
- [ ] admin analytics UI에 구 도메인 잔존 사용 섹션 추가
- [ ] 위키 analytics 문서와 log 반영
- [ ] `npm run lint` / `npm run test` 확인
