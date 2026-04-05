# 브라우저 확장 (Browser Extension)

> PC에서 OTT 작품 상세 페이지를 보다가 ottline 기록 화면으로 빠르게 연결하는 보조 도구

## 관련 페이지
- [[pwa]]

---

## 목적

- 모바일의 `공유 → 기록` 흐름을 데스크탑 브라우저까지 확장
- 자동 추적이 아닌 사용자 명시 클릭으로만 기록 시작

---

## 배포 현황

- **Chrome Web Store:** 배포 완료 (2026-03-26) — `achangjgnpbideilpolbohbkmmkmojpo`
- **Edge Add-ons Store:** 배포 완료 — `egghbkekjopgknhggoeiekgdooofihbo` — https://microsoftedge.microsoft.com/addons/detail/ottline-helper/egghbkekjopgknhggoeiekgdooofihbo

---

## 구조

```
apps/browser-extension/
├── manifest.json    (Manifest V3)
├── content.js       (DOM에서 제목/메타데이터 추출)
├── popup.html/css/js (팝업 UI)
└── README.md
```

---

## 동작 흐름

1. 지원 OTT 사이트의 작품 상세 페이지에서 content script가 제목을 읽음
2. 툴바 버튼 클릭 → 팝업 열림
3. 팝업에서 `ottline에 기록하기` 버튼 클릭
4. `https://ottline.app/ko`로 이동하며 QuickLog 초기값을 query param으로 전달
   - `capture_title`, `capture_type`, `capture_platform`, `capture_source_url`, `capture_source_site`
5. 웹앱에서 사용자가 최종 저장

---

## 지원 사이트

Netflix, Disney+, TVING, wavve, Coupang Play, WATCHA

- OTT 상세 페이지 URL 패턴 + `og:title` 기반 추출
- 사이트 구조 변경 시 보정 필요

---

## 제품 원칙

1. **자동 저장 금지** — 보기만 해도 기록되면 안 됨
2. **명시적 시작** — 확장 버튼 클릭 시에만 동작
3. **최소 권한** — `activeTab` + 필요 도메인만 `host_permissions`
4. **본체 분리** — 기록 저장/관리의 중심은 웹앱/PWA

**피해야 할 권한:** `<all_urls>`, 불필요한 background, 탭 히스토리 접근

---

## 패키지 생성

GitHub Actions `browser-extension-package.yml` 실행 → `ottline-helper-<version>.zip` 아티팩트

Chrome Web Store 제출 시 주의: 특정 OTT 서비스명 나열로 배포 거부된 사례 있음. 설명에서 서비스명 제외.

---

## 알려진 이슈

- Netflix 모달에서 날짜 텍스트("YYYY년 M월 D일")를 제목으로 잡는 케이스 있음
  - 임시 패치: `normalizeTitle` + `scanNetflixModalTitle`에 날짜 패턴 필터 추가
  - 근본 원인: `titleSelectors` 및 텍스트 스캔 범위가 넓어 메타데이터 엘리먼트를 잡음
  - 스토어 제출 전 제대로 고쳐야 함

## 다음 단계

1. Netflix 모달 selector 정밀화 (날짜/메타데이터 엘리먼트 제외)
2. 사이트별 캡처 정확도 전반 검증
3. locale/base URL 설정 페이지 추가 여부 검토
