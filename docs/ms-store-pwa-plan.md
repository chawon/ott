# Microsoft Store PWA 출시 계획

## 1. 목적
- `apps/web` PWA를 Microsoft Store(Windows) 배포 대상으로 정리한다.
- 현재 레포 상태에서 바로 제출 가능한 항목과 선행 수정 항목을 분리한다.
- Android TWA 문서와 별개로 Windows Store 제출 절차를 운영 문서로 남긴다.

## 2. 현재 판단
- 저장소에는 PWA/TWA 관련 문서는 있으나 Microsoft Store 전용 문서는 없었다.
- 현재 웹 앱은 PWA 기본 요건(manifest, icons, screenshots, install banner, service worker)을 이미 갖추고 있다.
- 현재 Microsoft Store 준비는 당분간 `On the Timeline` 브랜드 기준으로 진행한다.
- 다만 Store 제출 전 메타데이터와 운영 자산 정합성은 추가 점검이 필요하다.

## 3. 현재 코드 기준 준비 상태

### 이미 있는 것
1. Web App Manifest
   - `apps/web/app/manifest.ts`
   - PWABuilder 권고 항목 중 `id`, `orientation`, `categories` 반영 완료
2. 설치 아이콘
   - `apps/web/public/icon-192.png`
   - `apps/web/public/icon.png`
   - `apps/web/public/apple-touch-icon.png`
3. 스크린샷 자산
   - `apps/web/public/pwa/screenshot-desktop-wide.png`
   - `apps/web/public/pwa/screenshot-mobile-narrow.png`
4. 오프라인 페이지/서비스워커
   - `apps/web/public/sw.js`
   - `apps/web/app/[locale]/offline/page.tsx`
5. 설치 유도 UI
   - `apps/web/components/PwaInstallBanner.tsx`

### Store 제출 전 수정 필요
1. 도메인 정합성
   - 현재 검사/패키징 대상은 `https://ott.preview.pe.kr`
   - Store 실제 제출 시 사용할 운영 도메인과 일치시키는지 결정 필요
2. 스크린샷/아이콘 재검토
   - 기존 자산이 현재 `On the Timeline` 브랜드와 최신 UI에 맞는지 확인 필요
3. 정책 문서 링크 검토
   - Privacy / support URL을 Store listing에 넣을 최종 운영 주소 확정 필요
4. PWABuilder 재검사
   - 저장한 리포트 HTML 기준 권고 항목은 반영했으므로 fresh scan으로 결과 갱신 필요

## 4. Microsoft Store 제출 절차
공식 문서 기준 현재 흐름은 아래와 같다.

1. Microsoft Partner Center 개발자 계정 준비
2. 새 앱 이름 예약
3. Partner Center에서 아래 값 확보
   - Package ID
   - Publisher ID
   - Publisher display name
4. PWABuilder에서 사이트 URL 입력 후 검사
5. `Package for Stores`에서 Windows 패키지 생성
6. 생성된 패키지(`.msixbundle`, `.classic.appxbundle`)를 Store submission에 업로드
7. 스토어 메타데이터(설명, 카테고리, 연령 등급, 이미지) 입력 후 제출

## 5. 레포 기준 선행 작업

### P0
1. 운영 도메인을 Store 제출 기준과 일치시킴
2. 스크린샷이 현재 브랜드/UI와 맞는지 재촬영 또는 교체
3. PWABuilder fresh report 기준 필수/권고 항목 재확인

### P1
1. Store listing 초안 작성
   - 한국어
   - 영어
2. Privacy / Support / Website URL 확정
3. Windows 설치 후 첫 실행 QA
   - 로그인/페어링
   - 타임라인 조회
   - 문의함
   - 오프라인 복귀

## 6. 제출 체크리스트

### 웹/PWA
- [x] `manifest.ts`에 `id`, `orientation`, `categories` 반영
- [ ] `manifest.ts` 이름/설명/아이콘/스크린샷 최종 반영
- [ ] `layout.tsx` metadata / siteName / domain 정리
- [ ] 설치 후 standalone 실행 확인
- [ ] 서비스워커 최신 버전 확인
- [ ] `npm run build` 통과

### Store 메타데이터
- [ ] 앱 이름 예약
- [ ] 카테고리 확정
- [ ] 한국어/영어 설명문
- [ ] 앱 아이콘/hero image
- [ ] 스크린샷
- [ ] 개인정보처리방침 URL
- [ ] 지원 URL 또는 문의 URL

### QA
- [ ] Windows 설치 후 첫 실행
- [ ] 로그인/페어링 코드 생성
- [ ] PC 브라우저와 데이터 정합성
- [ ] unlink 후 세션 차단 동작
- [ ] 문의 등록 / 관리자 확인

## 7. 구현 영향 범위
- 프론트 메타데이터
  - `apps/web/app/manifest.ts`
  - `apps/web/app/[locale]/layout.tsx`
  - `apps/web/messages/ko.json`
  - `apps/web/messages/en.json`
- 스토어 자산
  - `apps/web/public/pwa/*`
  - 아이콘 세트
- 문서
  - Store listing copy
  - 운영 URL/정책 문서

## 8. 중요한 운영 메모
1. Microsoft Learn 문서 기준, 일반적인 웹 코드 수정만으로는 Store 재제출이 항상 필요한 것은 아니다.
2. 하지만 manifest 내용이 바뀌면 Windows 패키지에 복사되는 정보가 달라지므로 재패키징/재제출이 필요하다.
3. 현재는 `On the Timeline` 기준으로 진행하므로, Store 자산과 listing copy도 같은 기준으로 맞춰야 한다.
4. PWABuilder 저장 리포트에는 service worker 권고가 남아 있었지만 현재 코드에는 `apps/web/public/sw.js`가 있으므로, 재검사 결과를 다시 기준으로 삼는다.

## 9. 추천 다음 단계
1. PWABuilder fresh scan 재실행
2. Store listing 카피 문서 초안 추가
3. PWABuilder 패키징용 입력값 목록 문서화
4. 실제 Partner Center 제출 전 QA 체크리스트 실행

## 10. 참고 자료
- Microsoft Learn: Test and publish Progressive Web Apps (PWAs) for Microsoft Store
  - https://learn.microsoft.com/en-us/training/modules/publish-pwa-microsoft-store/
- Microsoft Edge Docs: Publish a PWA to the Microsoft Store
  - https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/microsoft-store
- PWABuilder
  - https://www.pwabuilder.com/
