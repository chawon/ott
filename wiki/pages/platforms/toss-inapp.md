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
| 검수 결과 | ❌ 반려 (2026-04-14) |
| 반려 대응 코드 | ✅ 완료 (2026-04-14) |
| 재제출 준비 | ✅ 실기기 재테스트 완료 |
| 출시 상태 | ✅ 공개 링크 운영 중 (2026-04-21 기준) |

## 기술 스택

- SDK: `@apps-in-toss/web-framework` v2.4.1
- 설정: `apps/web/granite.config.ts` (appName, brand, icon CDN URL), `apps/web/ottline.ait` (번들)
- 진입: `intoss://ottline`
- 공개 링크: `https://minion.toss.im/XYvjpUB2`
- 방식: 기존 Next.js 앱에 WebView SDK를 얹는 방식 (React Native 신규 개발 아님)

## 구현 완료 항목 (Phase 1)

- `@apps-in-toss/web-framework` 설치 및 `ait init`
- `granite.config.ts` 설정 (appName, primaryColor `#1E4D8C`, icon)
- PWA 설치 배너 — `window.__appsInToss` 감지 시 미니앱 환경에서 비활성화
- Service Worker — 미니앱 환경에서 등록 스킵
- 샌드박스 및 프로덕션 앱 접근 테스트 완료

## 정책 준수 검토 (Phase 2)

> 검토 완료: 2026-04-07

| 항목 | 결과 | 비고 |
|------|------|------|
| 자사 앱 설치 유도 금지 | ✅ 준수 | PWA 배너 `window.__appsInToss` 감지 시 비활성화 완료 |
| 공유카드 외부 링크 | ❌ **조치 필요** | "공유하기 링크가 자사 웹사이트로 랜딩되는 상태" = 명시적 제한 행위. 미니앱 환경에서 `ottline.app으로 열기` 버튼 제거 필요 |
| 로그인 정책 | ⚠️ 잠재 이슈 | 로그인 UI 없어 직접 충돌 없음. 페어링 코드는 커스텀 계정 연결로 판단될 여지 있음 |
| 결제 | ✅ 해당 없음 | 결제 기능 없음 |
| 광고 | ✅ 해당 없음 | 광고 없음 |
| 다크패턴 | ✅ 준수 | 온보딩 오버레이 현재 비활성화 상태 |
| 서비스 카테고리 | ✅ 출시 가능 | 금융·가상자산·의료 등 제한 카테고리 아님 |
| 앱 내 기능 등록 (비게임 필수 1개↑) | ✅ 완료 | 콘솔 등록 확인, 미니앱 재진입으로 동작 검증 완료 (2026-04-07) |

### 보류 항목

- [ ] **공유카드**: 심사 결과 확인 후 판단. 반려 시 `ShareBottomSheet`에서 `window.__appsInToss` 감지 시 `ottline.app으로 열기` 버튼 숨김 처리

참고: [자사 앱 설치/외부 링크 가이드라인](https://developers-apps-in-toss.toss.im/checklist/miniapp-external-link.md), [서비스 오픈 정책](https://developers-apps-in-toss.toss.im/intro/guide.md)

## 검수 피드백 및 이슈

### 2026-04-14 심사 반려 사유

1. 불필요한 화면 확대·축소 제스처가 활성화되어 있음
2. 일부 UI 컴포넌트 비정상 동작
   - 이미지 저장 미동작
   - 공유하기 버튼이 `준비 중...` 상태로 보임

### 2026-04-14 대응 코드

- `apps/web/app/[locale]/layout.tsx`
  - `tossmini.com` 또는 `window.__appsInToss` 환경에서 `viewport`를 `maximum-scale=1`, `user-scalable=no`로 강제
- `apps/web/lib/appsInToss.ts`
  - 앱인토스 브리지 유틸 추가 (`saveBase64Data`, `share`)
- `apps/web/lib/share.ts`
  - 저장 시 앱인토스 네이티브 저장 우선 사용
  - 앱인토스 환경에서는 공유 카드 이미지를 로컬 canvas로 생성해 미리보기/저장에 사용
  - Web Share(files) 또는 네이티브 파일 공유가 불가한 경우 앱인토스 텍스트 공유 fallback
- `apps/web/components/ShareBottomSheet.tsx`
  - preview 준비 여부와 무관하게 `공유하기` 버튼 즉시 활성화
  - 공유 시 이미지 blob 생성 우선, 실패 시에만 텍스트 공유로 fallback

### 2026-04-14 실기기 재테스트 결과

- [x] 앱인토스 sandbox/production 도메인에서 실제 핀치 줌 차단 확인
- [x] 공유 카드 미리보기 확인
- [x] 공유 카드 `이미지 저장` 동작 확인
- [x] `공유하기` 버튼이 `준비 중...` 상태에 고정되지 않음 확인
- [ ] 재제출 후 심사 결과 대기

### 2026-04-21 출시 반영

- 사용자 공개 진입 링크 운영 확인: `https://minion.toss.im/XYvjpUB2`
- 서비스 소개 문구는 "앱 설치 없이 토스에서 바로 열고, 페어링 코드만 입력하면 계속 기록하고 확인할 수 있다"는 메시지로 정리

### 현재 제한사항

- 앱인토스 SDK `share` 브리지는 텍스트 메시지 공유만 지원한다.
- 따라서 미니앱의 `공유하기`는 현재 이미지 첨부가 아니라 텍스트 공유로 동작한다.
- 심사 대응 기준에서는
  - 저장 버튼은 정상 동작
  - 공유 버튼도 정상 동작
  - 단, 공유 포맷은 SDK 제약상 텍스트다.

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
