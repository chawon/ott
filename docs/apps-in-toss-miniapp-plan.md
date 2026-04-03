# 앱인토스 미니앱 출시 계획

> 작성일: 2026-04-03

## 결론

**최소 작업으로 일단 출시 시도. 검수 이슈 발생 시 그때 대응.**

---

## 현황 분석

| 항목 | 현재 ottline | 앱인토스 요구사항 | 상태 |
|------|-------------|----------------|------|
| 프론트 | Next.js App Router | WebView SDK 지원 | ✅ 가능 |
| 인증 | 익명 UUID 자동 발급 (로그인 UI 없음) | 토스 로그인만 허용 (로그인 UI 기준) | ✅ 로그인 UI 없으므로 해당 없음 |
| 결제 | 없음 | 토스페이만 허용 | ✅ 해당 없음 |
| 서비스 성격 | 영화/시리즈 기록 | 금융·가상자산 아님 | ✅ 출시 가능 카테고리 |
| 외부 링크 | 공유카드 → ottline.app | 핵심 기능은 앱 내 완결 필요 | ⚠️ 검토 필요 |
| PWA (SW, 설치 배너) | 있음 | 자사 앱 설치 유도 금지 | ⚠️ 비활성화 필요 |
| iframe | 없음 | 금지 | ✅ 이미 준수 |
| 번들 크기 | - | 100MB 이하 | ✅ WebView 방식 무관 |
| 다국어 | ko/en 지원 | - | ✅ 플러스 요인 |

---

## 주의사항

### ⚠️ 페어링 코드 UI (검수 리스크 — 이슈 발생 시 대응)

ottline은 로그인 화면이 없고 UUID를 자동 발급하므로 "토스 로그인만 허용" 정책과 직접 충돌하지 않음.
페어링 코드는 로그인이 아닌 "기기 간 데이터 이전" 도구이나, 검수에서 커스텀 계정 연결로 볼 경우 이슈 가능.
→ **일단 그대로 제출, 검수 반려 시 토스 로그인 연동 검토.**

기기 초기화(앱 재설치 등) 시 데이터 유실은 기존 웹(PC 포맷)과 동일한 조건으로 허용된 정책.

### ⚠️ 외부 링크 정책

- 공유카드의 "ottline.app으로 열기" → 단순 정보 확인 목적이라면 허용 가능 범위
- PWA 설치 배너 → 앱 설치 유도 금지 정책에 해당, 미니앱 환경에서 비활성화 필요

---

## 권장 접근 방식: WebView SDK 포팅

React Native 신규 개발 대비 WebView 방식이 현실적.
기존 Next.js 앱에 `@apps-in-toss/web-framework`를 얹는 방식.

```bash
npm install @apps-in-toss/web-framework
npx ait init  # appName은 앱인토스 콘솔 앱명과 일치해야 함
```

---

## 단계별 실행 계획

### Phase 0 — 사전 준비 (비개발)

- [ ] 앱인토스 파트너사 신청 (콘솔 워크스페이스 생성)
- [ ] 미니앱 appName 확정 (`ottline` 등)

### Phase 1 — WebView SDK 연동 (1~2일)

- [ ] `@apps-in-toss/web-framework` 설치
- [ ] `ait init` 실행 및 설정 구성
- [ ] 샌드박스 앱에서 `intoss://ottline` 접근 테스트

### Phase 2 — 정책 준수 작업 (1~2일)

- [ ] PWA 설치 배너 미니앱 환경에서 비활성화
- [ ] Service Worker 미니앱 내 동작 여부 확인
- [ ] 공유카드 외부 링크 앱인토스 정책 범위 확인
- [ ] [비게임 출시 가이드 체크리스트](https://developers-apps-in-toss.toss.im/checklist/app-nongame.md) 전수 검토

### Phase 3 — 검수 및 출시

- [ ] 샌드박스에서 전체 기능 검증
- [ ] 앱 번들 콘솔 업로드
- [ ] 앱인토스 검토 요청
- [ ] 검수 반려 시 → 반려 사유에 따라 대응 (페어링 코드 이슈라면 토스 로그인 연동 검토)

---

## 참고 링크

- [앱인토스 개발자 센터](https://developers-apps-in-toss.toss.im)
- [WebView 튜토리얼](https://developers-apps-in-toss.toss.im/tutorials/webview.md)
- [토스 로그인 개발하기](https://developers-apps-in-toss.toss.im/login/develop.md)
- [서비스 오픈 정책](https://developers-apps-in-toss.toss.im/intro/guide.md)
- [비게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-nongame.md)
- [미니앱 출시 절차](https://developers-apps-in-toss.toss.im/development/deploy.md)
