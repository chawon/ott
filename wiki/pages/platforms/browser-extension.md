# 브라우저 확장

`ottline Helper`는 OTT 작품 상세 페이지에서 사용자가 팝업 버튼을 눌렀을 때 작품 제목과 플랫폼을 웹의 빠른 기록으로 넘긴다. 소스는 [`apps/browser-extension`](../../../apps/browser-extension)이다.

## 배포 및 유지보수

| 스토어 | 확인된 상태 |
| --- | --- |
| [Chrome Web Store](https://chromewebstore.google.com/detail/ottline-helper/achangjgnpbideilpolbohbkmmkmojpo) | 공개 페이지에서 `0.1.0` 확인 |
| [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/ottline-helper/egghbkekjopgknhggoeiekgdooofihbo) | 공개 제품 페이지 확인. `0.1.0` 배포 기록 |
| [Whale Store](https://store.whale.naver.com/detail/fdifiinpckjcafdndikchfhmkejhdfhc) | `0.1.0` 배포 기록과 공개 링크 유지 |

소스 manifest는 `0.1.1`이고 [Actions 패키지](https://github.com/chawon/ott/actions/runs/30154927303)가 생성됐다. 스토어별 게시 상태는 각 스토어에서 확인한다. 확장은 기존 캡처를 유지하며 데스크톱 앱 연결은 웹에서 제공한다.

## 빠른 기록 연결

1. Netflix, Disney+, TVING, wavve, Coupang Play, WATCHA의 지원 작품 상세 페이지에서 툴바의 확장 팝업을 연다.
2. 기록 버튼을 누르면 브라우저 언어에 따라 ottline 웹이 열리고 `quick=1`, `capture_title`, `capture_type`, `capture_platform` 등으로 검색을 채운다. 사용자가 최종 저장을 누른다.
3. Windows 일반 브라우저에서는 웹에서 계속 기록하거나 `ottline://quick`으로 [Windows 앱](windows-native.md)을 열 수 있다. `항상 Windows 앱으로 열기`는 다음 진입에서 앱 링크를 먼저 선택하며 클릭 또는 Enter로 앱을 연다. 미설치 사용자는 `cid=extension_handoff`가 붙은 Microsoft Store 링크를 이용할 수 있다.
4. [macOS 앱](macos-native.md) 연결은 Mac App Store 게시 이후 웹에서 활성화한다.

Windows 웹 연결은 [PR #138](https://github.com/chawon/ott/pull/138), Web SHA `4472ad3`로 2026-11-19 배포했다. 운영 Chromium에서 링크와 웹 기록을 검증했다. Windows 정식 설치 앱의 실행과 제목·플랫폼 미리 채움은 실기기 확인 항목이다. [공통 프로토콜·핸드오프](../../../docs/desktop-protocol-and-extension-bridge-plan-2026-11-18.md)

캡처 변경 시 지원 사이트에서 작품 상세 페이지와 미지원 페이지를 모두 확인하고 `node --test apps/browser-extension/extension.test.mjs`를 실행한다. 도메인 권한은 지원 사이트 목록으로 제한한다. 새 스토어 산출물은 [`browser-extension-package.yml`](../../../.github/workflows/browser-extension-package.yml)이 만든다. [초기 설계와 제출 이력](../../../docs/archive/desktop/browser-extension-mvp.md)
