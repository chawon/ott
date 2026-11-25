# ottline v2

Web/PWA의 v2 기록 흐름을 설명한다. Android·iOS·Windows·macOS의 적용 및 출시 상태는 [플랫폼 현황](../../../docs/platforms.md)을 따른다.

2026-11-08 Web/PWA와 API를 같은 SHA `b9f88a6d5f329ffa1bfaea4dacc3b7be8bfb3022`로 운영 반영했다. PC는 펼쳐보는 기록장, 모바일은 한 손 수첩으로 구성한다.

- 홈의 월별 대표·목록은 봤거나 읽은 작품만 모으며, 진행 중인 작품은 ‘아직 못다 한 이야기’에서 이어간다.
- 상태를 고르는 동작과 저장을 분리했다. 작품 선택 뒤 팝업 높이를 유지하고 하단 ‘기록 남기기’로 저장한다. 날짜·플랫폼·장소·상황·시즌/회차와 선택형 느낌·메모를 보존한다.
- 로컬 우선 기록, 기기 연결 뒤 홈 갱신, 정식 서버 ID 연결과 동기화 상태 안내를 정리했다. 실제 운영 브라우저 저장 후 outbox 0개와 서버 ID 일치를 확인했다.
- 새 심벌·파비콘·PWA 자산, 기존 Pretendard Bold 워드마크와 한·영 문구를 적용했다. 저장 뒤 다른 사람이 남긴 이야기는 선택적으로 열며, 기록이 없는 기간의 리포트 공유는 비활성화한다.
- [[future-timeline]]은 OpenAI 기반으로 제외·되돌리기·생성 결과·하루 3회를 서버 계정에 보관한다. 생성 버튼 앞과 개인정보처리방침에서 전송 항목을 안내한다.

API 169개와 Web CI, 운영 검색·기록·수정·동기화·연결·추천, 모바일/PC 기록창을 확인했다. Flyway V32는 테이블 4개만 추가하며 기존 기록·이력 수를 보존했다. 테스트 계정과 임시 검증 리소스는 정리했다.

`2026-11-11`에는 PR `#127`, Web SHA `aa99154`로 sitemap 수정일·v2 OG 이미지·페이지별 Twitter 메타데이터와 가이드 `Article`·`BreadcrumbList`를 운영 반영했다. 공개 URL 19개와 개인 화면 14개의 색인 경계를 확인했으며 API·네이티브 바이너리는 유지했다. [SEO 후속 배포 기록](../../../docs/seo-v2-refresh-2026-11-11.md)을 따른다.

`2026-11-09`에는 Android 네이티브 앱을 Play에 배포했다. 기존 TWA 계정과 미동기화 기록은 서버 설치 토큰과 브라우저 핸드오프로 이어받는다. [Android 전환](../../../docs/android-native-v2-transition.md)

`2026-11-12`에는 PR `#130`, Web SHA `4cabcd5`로 한·영 오프라인 재진입 안내, 검색 키보드·보조기술 지원, 모션 감소, 포커스 대비와 본문 바로가기를 운영 반영했다. 공개 자산 일치와 별도 브라우저 컨텍스트의 통신 실패 시 한·영 HTTP 200 fallback을 확인했다. [접근성·오프라인 배포 기록](../../../docs/web-offline-accessibility-2026-11-12.md)을 따른다.

`2026-11-18`에는 Windows 네이티브 `2.0.0.0`의 Microsoft Store 게시와 구형 Store PWA에서 계정·기록을 이어받는 동작을 확인했다. `2026-11-19` Web 배포에서 브라우저 확장이 여는 화면에 Windows 빠른 기록 링크를 추가했다. [Windows 전환](../../../docs/windows-native-v2-transition.md) · [확장 연결](../../../docs/desktop-protocol-and-extension-bridge-plan-2026-11-18.md)

`2026-11-25`부터 한 기기가 복구한 과거 기록은 먼저 동기화를 마친 다른 기기에도 원래 편집 시각으로 도착한다. 같은 기록을 더 최근에 고쳤다면 최근 편집이 남는다. [기존 기기 수신과 운영 검증](../../../docs/changes/api-sync-delivery-171-2026-11-25.md)

- [운영 배포와 검증](../../../docs/ottline-v2-production-rollout.md)
- [플랫폼별 출시 현황](../../../docs/platforms.md)
- [웹 구현 기록](../../../docs/ottline-ux-v2-web.md)
- [Android Native v2 전환 및 TWA 자동 복구 기록](../../../docs/android-native-v2-transition.md)
- [Windows Native v2 전환 및 Store 출시 기록](../../../docs/windows-native-v2-transition.md)

관련: [[android-native]], [[windows-native]], [[ms-store]], [[timeline]], [[future-timeline]], [[personal-profile]], [[share-card]], [[pwa]].
