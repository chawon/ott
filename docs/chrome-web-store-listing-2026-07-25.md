# Chrome Web Store 0.1.1 등록 자료

기준일: 2026-07-25

## 구현·배포 상태

- PR: `#84`
- main merge SHA:
  `1da056e8a10411d1eccc4f4728a33f64344a9420`
- main Verify Web:
  `30154927307` (`success`)
- main Package Browser Extension:
  `30154927303` (`success`)
- 제출용 artifact:
  `ottline-helper-0.1.1` (`expired=false`)
- web production:
  `30155096937` (`success`)
- production manifest:
  `041f1e71fb2e96f6fa427b8a1be805d510849b87`
- ArgoCD:
  `ott-app` `Synced Healthy`
- production web:
  image tag `1da056e8a10411d1eccc4f4728a33f64344a9420`,
  `APP_VERSION=1da056e`, Pod `1/1 Ready`
- production Pod 내부 확인:
  한국어·영어 `/about`에서 별도 브라우저 확장 `SoftwareApplication`
  JSON-LD와 `hl=ko`/`hl=en` Chrome Web Store 링크 렌더링
- IndexNow:
  production workflow의 Bing 알림 단계 `success`

코드와 제출 패키지 준비, 웹 production 반영까지 완료했다. Chrome Web Store
공개 버전은 대시보드에서 `ottline-helper-0.1.1.zip`을 업로드하고 심사 제출한
뒤에야 0.1.1로 바뀐다. 현재 공개 항목을 0.1.1로 확인하기 전에는 스토어 게시
완료로 기록하지 않는다.

## 목표

- 기존 `ottline Helper`와 영어로만 노출되던 요약을 한국어·영어 검색 의도에 맞게 정리한다.
- 확장의 실제 역할인 `OTT/streaming 기록 도우미`를 제목과 요약 앞부분에서 분명히 알린다.
- 확장 내부 팝업, 상세 설명, 스크린샷의 한국어·영어 기능 범위를 일치시킨다.
- 자동 추적이나 자동 저장으로 오해할 표현은 사용하지 않는다.

## 패키지 메타데이터

Chrome Web Store의 이름과 132자 이하 요약은 패키지의 `_locales` 메시지를
사용한다.

| 항목 | 한국어 | English |
| --- | --- | --- |
| 이름 | `ottline - OTT 기록 도우미` | `ottline - Streaming Log Helper` |
| 요약 | `OTT 작품 페이지의 제목을 읽어 ottline 시청 기록 화면으로 바로 연결합니다.` | `Send a title from a supported streaming page to ottline QuickLog, ready for you to review and save.` |
| 버전 | `0.1.1` | `0.1.1` |

## 상세 설명

### 한국어

```text
웹에서 보고 있던 작품을 ottline 기록 화면으로 가볍게 이어보세요.

작품 상세 페이지에서 확장을 열면 제목과 플랫폼을 읽어 ottline QuickLog에 미리 채웁니다. 내용을 확인하고 상태, 평점, 메모를 더한 뒤 직접 저장할 수 있어요.

- 제목을 다시 입력하는 수고를 줄여요.
- 기록은 ottline에서 확인한 뒤 직접 저장해요.
- 자동 시청 추적이나 백그라운드 기록을 하지 않아요.
- 현재 탭에서 필요한 정보만 읽어요.

ottline은 영화·시리즈·책 기록을 나만의 타임라인으로 모으는 기록 서비스입니다.
```

### English

```text
Move smoothly from the title you are viewing to a new log in ottline.

Open the extension on a supported title detail page to prefill the title and streaming service in ottline QuickLog. Review the details, add your status, rating, or note, and save the log yourself.

- Skip typing the title again.
- Review every log in ottline before saving.
- No automatic watch tracking or background logging.
- Reads only the information needed from the current tab.

ottline brings your movie, series, and book logs together in a personal timeline.
```

개별 OTT 서비스 이름은 상세 설명에 나열하지 않는다. 과거 Chrome 심사에서
서비스명 나열이 반려 사유가 된 이력이 있으며, 기능 설명에는 필요하지 않다.

## 대시보드 값

| 필드 | 값 |
| --- | --- |
| Primary category | `Entertainment` |
| Official URL | `https://ottline.app` |
| Homepage URL (ko) | `https://ottline.app/about` |
| Homepage URL (en) | `https://ottline.app/en/about` |
| Support URL (ko) | `https://ottline.app/feedback?source=chrome-extension` |
| Support URL (en) | `https://ottline.app/en/feedback?source=chrome-extension` |
| Privacy policy (ko) | `https://ottline.app/privacy` |
| Privacy policy (en) | `https://ottline.app/en/privacy` |
| Mature content | 사용 안 함 |
| Distribution | 전체 지역 |

## 그래픽 자산

- Store icon: `apps/browser-extension/icons/icon-128.png`
- 한국어 스크린샷:
  `apps/browser-extension/store-assets/ko/chrome-web-store-01.png`
- English screenshot:
  `apps/browser-extension/store-assets/en/chrome-web-store-01.png`
- Small promo tile:
  `apps/browser-extension/store-assets/global/small-promo-tile-440x280.png`
- Marquee promo tile:
  `apps/browser-extension/store-assets/global/marquee-promo-tile-1400x560.png`

스크린샷은 최신 0.1.1 팝업을 실제 렌더링한 1280×800 PNG다. Store listing에서
언어를 한국어와 English로 각각 선택한 뒤 해당 언어의 상세 설명과 스크린샷을
등록한다. 프로모션 타일은 전역 자산으로 등록한다.

## 개인정보 공개 점검

- 확장은 사용자가 툴바 버튼을 누른 현재 탭에서만 동작한다.
- 허용된 작품 사이트만 `host_permissions`에 선언한다.
- 방문 기록 전체, 백그라운드 시청 이력, 계정 정보는 수집하지 않는다.
- 제목, 플랫폼 키, 현재 URL은 사용자가 버튼을 누른 뒤 ottline QuickLog URL의
  초기값으로만 전달한다.
- 실제 기록 저장은 사용자가 ottline에서 내용을 확인한 뒤 수행한다.

## 게시 순서

1. GitHub Actions의 `Package Browser Extension`에서
   `ottline-helper-0.1.1.zip`을 받는다.
2. 기존 Chrome Web Store 항목에 새 패키지를 업로드한다.
3. Store listing 언어 드롭다운에서 한국어와 English 상세 설명·스크린샷을 각각
   입력한다.
4. 카테고리, 공식 URL, 홈페이지, 지원, 개인정보처리방침 값을 확인한다.
5. Privacy 탭의 데이터 사용 선언이 위 동작 및 개인정보처리방침과 일치하는지
   확인한다.
6. 변경사항을 심사 제출한다.
7. 공개 후 한국어·영어 페이지에서 이름, 요약, 상세 설명, 첫 스크린샷, 버전을
   각각 확인한다.

현재 Chrome Web Store 항목:
`https://chromewebstore.google.com/detail/achangjgnpbideilpolbohbkmmkmojpo`
