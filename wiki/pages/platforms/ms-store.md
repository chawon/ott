# Microsoft Store

2026-11-18 기존 PWABuilder Edge PWA `1.0.1.0`에서 [Windows 네이티브 앱](windows-native.md) `2.0.0.0`으로 전환했다. 동일한 Store 제품에서 기존 사용자가 업데이트할 수 있다.

| 항목 | 현재 운영 기준 |
| --- | --- |
| Product ID | `9NSVNZGDMGF5` |
| 패키지 ID | `ChawonLee.ottline` |
| Package Family Name | `ChawonLee.ottline_ry7416pek43sa` |
| 게시 확인 | `2.0.0.0`, 제출 `1152921505702424456` (`Published`), x64·arm64 MSIXBundle |
| 스토어 제목 | 한국어 `ottline - 영화·드라마·책·독서 기록`, 영어 `ottline: Movie, TV & Book Log` |

[Microsoft Store 제품 페이지](https://apps.microsoft.com/detail/9nsvnzgdmgf5?hl=ko-KR&gl=KR)에서 열거나 Windows에서 `winget install --id 9NSVNZGDMGF5 --source msstore`로 설치한다. 2026-11-18 정식 설치 및 별도 PC에서 기존 PWA 업데이트 후 브라우저 세션 이어받기를 확인했다. 2026-11-20 한국어 Microsoft 카탈로그에서 `2.0.0.0` x64·arm64 등록을 다시 확인했다. [전환 및 검증 기록](../../../docs/windows-native-v2-transition.md)

## 패키징과 웹 유입

- 새 제출은 [`native-windows-release.yml`](../../../.github/workflows/native-windows-release.yml) 및 [`publish-msstore.ps1`](../../../apps/windows-native/scripts/publish-msstore.ps1)을 사용한다. 등록용 에셋은 [`packaging/StoreListing`](../../../apps/windows-native/packaging/StoreListing)에 있다.
- 웹 배너, 빠른 기록 저장 후 CTA, 서비스 소개 카드 및 브라우저 확장 연결의 Store 링크에는 각각 캠페인 `cid`가 붙는다. 웹 CTA 클릭과 Store 설치는 별도 지표다. [Web/API 배포 기록](../../../docs/desktop-acquisition-rollout-2026-11-18.md)
- 실제 앱의 빠른 기록 단축키는 `Ctrl+Shift+O`다. 한·영 웹 문구도 2026-11-19 배포된 [PR #138](https://github.com/chawon/ott/pull/138)에서 정정했다.

[초기 PWABuilder 계획](../../../docs/archive/desktop/ms-store-pwa-plan.md) · [이전 스토어 문구](../../../docs/archive/desktop/ms-store-listing-copy.md)
