# 토스 인앱 (앱인토스 미니앱)

> @apps-in-toss/web-framework 기반 WebView 방식으로 ottline을 토스 앱 내 미니앱으로 출시

## 관련 페이지
- [[twa]]
- [[pwa]]
- [[ottline-branding]]

---

## 현황

| 항목 | 상태 |
|------|------|
| 파트너사 신청 | ✅ 완료 |
| appName 확정 | ✅ `ottline` |
| 앱 등록 및 검수 요청 | ✅ 2026-04-05 완료 |
| 검수 결과 | ⏳ 대기 중 (2차 재제출: 2026-04-07) |

## 기술 스택

- SDK: `@apps-in-toss/web-framework` v2.4.1
- 설정: `apps/web/granite.config.ts` (appName, brand, icon CDN URL), `apps/web/ottline.ait` (번들)
- 진입: `intoss://ottline`
- 방식: 기존 Next.js 앱에 WebView SDK를 얹는 방식 (React Native 신규 개발 아님)

## 구현 완료 항목 (Phase 1)

- `@apps-in-toss/web-framework` 설치 및 `ait init`
- `granite.config.ts` 설정 (appName, primaryColor `#1E4D8C`, icon)
- PWA 설치 배너 — `window.__appsInToss` 감지 시 미니앱 환경에서 비활성화
- Service Worker — 미니앱 환경에서 등록 스킵
- 샌드박스 및 프로덕션 앱 접근 테스트 완료

## 정책 준수 검토 (Phase 2 — 미완료)

- [ ] 공유카드 외부 링크(`ottline.app으로 열기`) 정책 범위 확인
- [ ] [비게임 출시 가이드 체크리스트](https://developers-apps-in-toss.toss.im/checklist/app-nongame.md) 전수 검토

## 검수 피드백 및 이슈

### 아이콘 & 썸네일 (2026-04-06 피드백)

**요건**: 크롭되지 않으며 배경색이 포함된 꽉 찬 사각형으로 제출

| 파일 | 조치 | 결과 |
|------|------|------|
| `public/icon-600.png` | 투명 모서리 → `#F0F6FF` 배경색으로 채움, CDN 재업로드 | ✅ 완료 (2026-04-07) |
| `public/thumbnail-1932x828.png` | 양쪽 177px 레터박스 바 → 수직 그래디언트 연장으로 제거, 재업로드 | ✅ 완료 (2026-04-07) |

> `granite.config.ts`의 icon은 토스 콘솔에 `icon-600.png`를 업로드해서 발급받은 CDN URL(`static.toss.im/appsintoss/...`)로 설정되어 있음. 검수 피드백의 아이콘 문제는 이 파일이 원인. `.ait` 번들의 icon은 별도로 `./public/icon-192.png` 참조.

### 페어링 코드 (잠재적 이슈)

로그인 UI가 없으므로 "토스 로그인만 허용" 정책과 직접 충돌하지 않음.
단, 검수에서 페어링 코드를 커스텀 계정 연결로 판단할 경우 반려 가능성 있음.
→ 반려 시 토스 로그인 연동 검토.

## 참고

- [앱인토스 개발자 센터](https://developers-apps-in-toss.toss.im)
- [WebView 튜토리얼](https://developers-apps-in-toss.toss.im/tutorials/webview.md)
- [비게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-nongame.md)
- [미니앱 출시 절차](https://developers-apps-in-toss.toss.im/development/deploy.md)
