# Microsoft Store PWA 출시 계획

## 1. 목적
- `apps/web` PWA를 Microsoft Store(Windows) 배포 대상으로 정리한다.
- 현재 레포 상태에서 바로 제출 가능한 항목과 선행 수정 항목을 분리한다.
- Android TWA 문서와 별개로 Windows Store 제출 절차를 운영 문서로 남긴다.

## 2. 현재 판단
- 저장소에는 PWA/TWA 관련 문서는 있으나 Microsoft Store 전용 문서는 없었다.
- 현재 웹 앱은 PWA 기본 요건(manifest, icons, screenshots, install banner, service worker)을 이미 갖추고 있다.
- 현재 Microsoft Store 준비는 당분간 `On the Timeline` 브랜드 기준으로 진행한다.
- PWABuilder 기준 `service worker` 감지는 해결됐고, 최신 패키지 생성 및 인증 심사 신청까지 진행했다.
- 다만 Store 메타데이터와 운영 자산 정합성은 추가 점검이 필요하다.

## 3. 현재 코드 기준 준비 상태

### 이미 있는 것
1. Web App Manifest
   - `apps/web/app/manifest.ts`
   - PWABuilder 권고 항목 중 `id`, `orientation`, `categories` 반영 완료
   - `name`, `short_name` 모두 `On the Timeline`으로 통일 완료
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
   - production 초기 스크립트에서 서비스워커 등록하도록 조정해 PWABuilder 감지 확인
5. 설치 유도 UI
   - `apps/web/components/PwaInstallBanner.tsx`
6. Store 제출용 추가 자산
   - `apps/web/public/store/store-poster-720x1080.png`
   - `apps/web/public/store/store-poster-1440x2160.png`
   - `apps/web/public/store/store-box-1080x1080.png`
   - `apps/web/public/store/store-box-2160x2160.png`
7. Store listing 문구 초안
   - `docs/ms-store-listing-copy.md`

### Store 제출 전 수정 필요
1. 도메인 정합성
   - 현재 검사/패키징 대상은 `https://ott.preview.pe.kr`
   - Store 실제 제출 시 사용할 운영 도메인과 일치시키는지 결정 필요
2. 스크린샷/아이콘 재검토
   - 기존 앱 스크린샷과 새 Store 포스터/박스 아트의 최종 채택본 확정 필요
3. 정책 문서 링크 검토
   - Privacy / support URL을 Store listing에 넣을 최종 운영 주소 확정 필요
4. 인증 심사 후속 대응
   - Microsoft 추가 질문 또는 자산 수정 요청 시 응답 필요

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
2. 스크린샷/포스터/박스 아트 최종본 확정
3. 인증 심사 피드백 대응

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
- [x] `manifest.ts` 이름/short name을 `On the Timeline`으로 통일
- [ ] `manifest.ts` 설명/아이콘/스크린샷 최종 반영
- [ ] `layout.tsx` metadata / siteName / domain 정리
- [ ] 설치 후 standalone 실행 확인
- [x] 서비스워커 최신 버전 확인
- [x] `npm run build` 통과

### Store 메타데이터
- [x] 앱 이름 예약
- [ ] 카테고리 확정
- [x] 한국어/영어 설명문 초안
- [x] 앱 아이콘/hero image 초안
- [x] 스크린샷 기본 자산 준비
- [ ] 개인정보처리방침 URL
- [ ] 지원 URL 또는 문의 URL
- [x] 인증 심사 신청

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
5. 최신 패키지의 `runFullTrust`는 앱 자체의 네이티브 권한 사용이 아니라 PWABuilder/Edge 기반 데스크톱 PWA 패키징 모델 때문에 선언된 것으로 확인했다.

## 9. 추천 다음 단계
1. Microsoft 인증 심사 결과 확인
2. 추가 질의 오면 `runFullTrust` 및 PWA 패키징 구조 기준으로 답변
3. Store listing 최종 카테고리/URL 확정
4. 승인 후 실제 설치 QA 체크리스트 실행

## 10. 참고 자료
- Microsoft Learn: Test and publish Progressive Web Apps (PWAs) for Microsoft Store
  - https://learn.microsoft.com/en-us/training/modules/publish-pwa-microsoft-store/
- Microsoft Edge Docs: Publish a PWA to the Microsoft Store
  - https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/microsoft-store
- PWABuilder
  - https://www.pwabuilder.com/
