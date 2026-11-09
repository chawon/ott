# ottline v2

2026-11-08 Web/PWA와 API를 같은 SHA `b9f88a6d5f329ffa1bfaea4dacc3b7be8bfb3022`로 운영 반영했다. PC는 펼쳐보는 기록장, 모바일은 한 손 수첩으로 구성한다.

- 홈의 월별 대표·목록은 봤거나 읽은 작품만 모으며, 진행 중인 작품은 ‘아직 못다 한 이야기’에서 이어간다.
- 상태를 고르는 동작과 저장을 분리했다. 작품 선택 뒤 팝업 높이를 유지하고 하단 ‘기록 남기기’로 저장한다. 날짜·플랫폼·장소·상황·시즌/회차와 선택형 느낌·메모를 보존한다.
- 로컬 우선 기록, 기기 연결 뒤 홈 갱신, 정식 서버 ID 연결과 동기화 상태 안내를 정리했다. 실제 운영 브라우저 저장 후 outbox 0개와 서버 ID 일치를 확인했다.
- 새 심벌·파비콘·PWA 자산, 기존 Pretendard Bold 워드마크와 한·영 문구를 적용했다. 저장 뒤 다른 사람이 남긴 이야기는 선택적으로 열며, 기록이 없는 기간의 리포트 공유는 비활성화한다.
- [[future-timeline]]은 OpenAI 기반으로 제외·되돌리기·생성 결과·하루 3회를 서버 계정에 보관한다. 생성 버튼 앞과 개인정보처리방침에서 전송 항목을 안내한다.

API 169개와 Web CI, 운영 검색·기록·수정·동기화·연결·추천, 모바일/PC 기록창을 확인했다. Flyway V32는 테이블 4개만 추가하며 기존 기록·이력 수를 보존했다. 테스트 계정과 임시 검증 리소스는 정리했다.

`2026-11-09`에는 순수 Android 네이티브 앱([[android-native]], `apps/android-native`)을 모노레포에 통합해 Google Play `production` 트랙에 `2.0.0`(`versionCode=24`, SHA `45ccac3`) 및 기존 TWA 세션·기록 2단계 자동 복구를 포함한 `2.0.1`(`versionCode=25`, SHA `916be7a`)을 배포하고 v2 스토어 아이콘·피처 그래픽·스크린샷 5장을 반영했다. iOS·Windows·확장·토스 패키지는 플랫폼별 작업과 제출을 별도로 진행한다.

- [운영 배포와 검증](../../../docs/ottline-v2-production-rollout.md)
- [플랫폼별 출시 준비](../../../docs/ottline-v2-release-readiness.md)
- [웹 구현 기록](../../../docs/ottline-ux-v2-web.md)
- [Android Native v2 전환 및 TWA 자동 복구 기록](../../../docs/android-native-v2-transition.md)

관련: [[android-native]], [[timeline]], [[future-timeline]], [[personal-profile]], [[share-card]], [[pwa]].
