# Microsoft Store

2026-11-18 기존 PWABuilder Edge PWA `1.0.1.0`에서 [Windows 네이티브 앱](windows-native.md) `2.0.0.0`으로 전환했다. 동일한 Store 제품에서 기존 사용자가 업데이트할 수 있다.

| 항목 | 현재 운영 기준 |
| --- | --- |
| Product ID | `9NSVNZGDMGF5` |
| 패키지 ID | `ChawonLee.ottline` |
| Package Family Name | `ChawonLee.ottline_ry7416pek43sa` |
| 현재 공개 버전 | `2.0.2.0`, x64·arm64 MSIXBundle. 11월 25일 한국·미국 Microsoft Store 카탈로그에서 확인했다. |
| 스토어 제목 | 한국어 `ottline - 영화·드라마·책·독서 기록`, 영어 `ottline: Movie, TV & Book Log` |

Windows에서는 [Microsoft Store 제품 페이지](https://apps.microsoft.com/detail/9nsvnzgdmgf5?hl=ko-KR&gl=KR)에서 설치하거나 `winget install --id 9NSVNZGDMGF5 --source msstore`를 사용한다.

11월 25일 두 시장에 `ChawonLee.ottline_2.0.2.0_neutral_~_ry7416pek43sa`와 x64·arm64 패키지가 노출됐다. 후속 `2.0.3.0`은 병합·CI를 마쳤다. [한국 카탈로그](https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=9NSVNZGDMGF5&market=KR&languages=ko-KR) · [미국 카탈로그](https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=9NSVNZGDMGF5&market=US&languages=en-US) · [후속 설치판 검증](https://github.com/chawon/ott/issues/161#issuecomment-7162883131)

11월 23일 한국·미국 카탈로그 모두 `ChawonLee.ottline_2.0.1.0_neutral_~_ry7416pek43sa`를 제공했다. 이 업데이트에는 서버 계정 삭제 수정이 포함되며, 같은 날 Store 설치판(`ChawonLee.ottline_2.0.1.0_arm64__ry7416pek43sa`)에서 서버 삭제 성공 시 로컬 초기화와 오프라인 실패 시 기록 보존 실기기 검증을 완료했다. [한국 카탈로그](https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=9NSVNZGDMGF5&market=KR&languages=ko-KR) · [미국 카탈로그](https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=9NSVNZGDMGF5&market=US&languages=en-US) · [검증 항목](../features/delete-sync.md#windows-확인-사항)

첫 네이티브 버전 `2.0.0.0`은 11월 18일 정식 설치와 기존 PWA 업데이트 후 브라우저 세션 이어받기를 확인했다. [전환 기록](../../../docs/windows-native-v2-transition.md)

## 패키징과 웹 유입

- 새 제출은 [`native-windows-release.yml`](../../../.github/workflows/native-windows-release.yml) 및 [`publish-msstore.ps1`](../../../apps/windows-native/scripts/publish-msstore.ps1)을 사용한다. 등록용 에셋은 [`packaging/StoreListing`](../../../apps/windows-native/packaging/StoreListing)에 있다.
- 웹 배너, 빠른 기록 저장 후 CTA, 서비스 소개 카드 및 브라우저 확장 연결의 Store 링크에는 각각 캠페인 `cid`가 붙는다. 웹 CTA 클릭과 Store 설치는 별도 지표다. [Web/API 배포 기록](../../../docs/desktop-acquisition-rollout-2026-11-18.md)
- 실제 앱의 빠른 기록 단축키는 `Ctrl+Shift+O`다. 한·영 웹 문구도 2026-11-19 배포된 [PR #138](https://github.com/chawon/ott/pull/138)에서 정정했다.

[초기 PWABuilder 계획](../../../docs/archive/desktop/ms-store-pwa-plan.md) · [이전 스토어 문구](../../../docs/archive/desktop/ms-store-listing-copy.md)
