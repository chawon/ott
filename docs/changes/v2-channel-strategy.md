# 브라우저 확장·토스 인앱·ChatGPT 앱 개편 방향

세 채널은 각자의 사용 상황에 맞춰 운영한다. 브라우저 확장은 OTT에서 빠른 기록으로 연결하고, 토스 인앱은 토스 안에서 기록을 완결하며, ChatGPT 앱은 이미 남긴 기록으로 대화를 이어간다. 출시 상태는 [플랫폼 현황](../platforms.md)을 따른다. 확장 실기기 확인을 먼저 진행하고 ChatGPT 제출 경로 확인은 병행한다. 토스는 핵심 동작과 실제 사용을 확인한 뒤 갱신 범위를 결정한다.

| 채널 | 이번 방향 | 다음 판단 기준 |
| --- | --- | --- |
| 브라우저 확장 | **유지하고 작은 업데이트 1회 준비.** 원본 OTT URL 전송을 제거하고 스토어 자료를 정비한다. | 공개판으로 Windows 연결을 확인하고, 새 확장은 Chrome에서 먼저 검증한 뒤 Edge·Whale에 반영한다. |
| 토스 인앱 | **공개판 유지.** 한국어 작품 검색·기록·타임라인을 토스 안에서 제공한다. | 운영 번들의 핵심 동작과 기록·재기록 규모를 확인한다. 장애가 있으면 해당 경로를 고치고, 반복 사용이 확인되면 핵심 화면 위주로 갱신한다. |
| ChatGPT 앱 | **기존 읽기 전용 앱의 재제출 준비.** 실제 ChatGPT 동작과 제출 자료를 다시 검증한다. | 기존 제출 건의 갱신 경로, 테스트 계정의 연결·조회, 현재 제출 요건을 확인한 뒤 재제출을 결정한다. |

## 브라우저 확장

Chrome·Edge·Whale에서 사용자가 OTT 작품 상세의 확장 버튼을 누르면 제목·종류·플랫폼을 Web 빠른 기록으로 보내고 저장은 사용자가 마친다. Windows 앱 열기와 스토어 링크는 기존 공개 확장에서도 운영 Web이 제공한다. 공개 확장 버전과 소스 버전은 별도로 본다. Chrome 공개판은 `0.1.0`, 저장소 manifest는 `0.1.1`이며 나머지 스토어 최신판은 제출 전에 확인한다. [Chrome 공개판](https://chromewebstore.google.com/detail/ottline-helper/achangjgnpbideilpolbohbkmmkmojpo) · [확장 Wiki](../../wiki/pages/platforms/browser-extension.md) · [Windows 연결 배포](../desktop-protocol-and-extension-bridge-plan-2026-11-18.md#phase-a-운영-배포-2026-11-19)

1. 스토어에서 설치한 기존 확장으로 지원 OTT 작품을 열고, 제목·플랫폼으로 웹에서 기록할 수 있는지 확인한다. Windows 스토어판이 설치된 PC에서는 Web의 앱 열기로 실제 빠른 기록 창과 프리필을 확인한다. 앱이 없는 경우 설치 링크와 Web 기록이 동작해야 한다.
2. 다음 패키지에서 Web이 사용하지 않는 `capture_source_url`을 제거한다. `activeTab`으로 팝업 캡처와 미지원 페이지 안내가 동작하는지 Chrome·Edge·Whale에서 확인해 광범위한 `tabs` 권한을 줄인다. 제목·플랫폼 전달 계약을 유지하고, 확장 한·영 설명·화면 자료의 실제 동작과 권한·데이터 고지를 맞춘다. [현재 URL 빌더](../../apps/browser-extension/popup-core.js) · [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab/) · [Chrome Web Store 권한 정책](https://developer.chrome.com/docs/webstore/program-policies/permissions)
3. Chrome 공개판으로 배포 후 흐름을 재확인하고 Edge·Whale에도 같은 변경을 적용한다. macOS는 Mac App Store 게시와 설치 앱의 링크·프리필 검증 후 Web의 연결을 활성화한다. 이후 OS별 앱 연결 변경도 Web에서 관리한다.

## 토스 인앱

`내 OTT 타임라인` 공개판과 기존 기록을 유지한다. 별도 배포 브랜치의 정적 번들이 토스 앱에서 실행되므로 Web v2 배포와 별개다. 갱신한다면 제목 검색, 명시적인 기록 저장, 다시 열었을 때의 타임라인을 우선 맞춘다. 토스 안에서 정적·클라이언트 렌더링으로 흐름을 끝내고, 기존 이미지 저장과 텍스트 공유를 보존한다. 다른 앱 설치나 사이트 이동을 유도하는 Web CTA는 가져오지 않는다. [운영 브랜치와 빌드](../../wiki/pages/platforms/toss-inapp.md) · [토스 비게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-nongame.md)

1. 콘솔의 현재 공개 번들을 출시 브랜치와 대조하고 iOS·Android 토스 앱에서 검색 → 저장 → 종료 후 다시 열기를 실측한다. 연결된 기기로 기록이 이어지는지, 미동기화 기록이 있던 기존 사용자가 새 번들에서 기록을 보존하는지 확인한다. 기존 연결 코드 방식은 데이터 연속성을 보존하면서 새 검토의 자사 로그인 제한과 맞는지 확인한다.
2. 공개 링크와 출시 이력은 확인했으며, 콘솔의 최신 번들과 실제 사용량은 확인 전이다. 최근 사용량은 토스 콘솔과 운영 호스트의 기존 집계에서 먼저 확인한다. 방문 수와 실제 기록 사용자·재기록 사용자 수를 구분하고 테스트 트래픽을 제외한다. 기존 `log_create`는 동기화 전에 발생하므로 서버 저장 성공을 별도로 확인한다. 이용 데이터가 비어 있거나 확보되지 않으면 사용자가 없다고 판정하지 않는다.
3. 핵심 동작에 장애가 있으면 해당 흐름을 우선 복구한다. 반복 기록 수요가 확인되면 검색·저장·재진입을 한 번의 소규모 번들로 갱신한다. 갱신 시 토스 샌드박스와 실기기에서 두 OS를 확인하고 동일한 미니앱에 제출한다. 다른 v2 화면의 이식은 사용 근거가 생길 때 검토한다.

## ChatGPT 앱

공개 서비스는 현재 미운영이다. 2026-05-06 OpenAI 반려 통지에 기재된 사유는 제출 스크린샷 요건 미충족이다. 당시 [이미지 생성 기록](../archive/chatgpt/chatgpt-directory-screenshots-2026-04-22.md)은 위젯 단독 렌더링을 사용했다. 당시 파일은 참고 자료로 두고, 현재 제출 화면에 맞춰 실제 ChatGPT에서 샘플 계정의 연결 → 기록 요청 → 결과 위젯이 보이는 자료를 다시 만든다. 기존 제출 건이 현재 Plugins 콘솔에서 이어지는지 확인하고, 현재 제출 경로에서 요구하는 시연 영상과 긍정·부정 테스트 케이스를 준비한다. [OpenAI 제출 절차](https://developers.openai.com/plugins/deploy/submission) · [MCP 심사 요건](https://developers.openai.com/plugins/deploy/app-review)

- 첫 사용 사례는 “최근 다 본 시리즈를 내 기록에서 보여줘” 또는 “최근 다 읽은 책을 정리해줘”다. `timeline.list_recent_logs`와 OAuth의 읽기 전용 흐름을 재사용한다. 기록 작성·수정·삭제와 범용 콘텐츠 추천은 이 제출 범위에서 제외한다. [현재 연결 계약](../product-contracts.md#chatgpt-app) · [OpenAI 앱 설계 가이드](https://developers.openai.com/blog/what-makes-a-great-chatgpt-app)
- 기존 응답에는 메모·장소·상황도 포함된다. 조회의 기본 결과는 요청에 필요한 항목만 반환하는 방향으로 정리하고, 결과에 포함되는 데이터와 한·영 연결 안내·개인정보 고지를 일치시킨다. 기록 연결 코드는 ottline OAuth 화면에서 다룬다. 심사에는 샘플 데이터가 있는 전용 계정을 사용한다. [현재 도구 코드](../../apps/web/lib/chatgpt/mcpServer.ts) · [OpenAI 플러그인 가이드라인](https://developers.openai.com/plugins/plugin-guidelines)
- 실제 ChatGPT에서 한·영 연결과 조회, 기록이 없는 계정, 인증 만료·연결 해제, 다른 계정의 기록 격리를 검증한다. 사용자에게 지원한다고 안내하는 환경에서 화면과 모델 답변을 실제 기록과 대조한다. 이 검증과 현재 제출 자료 확인을 마친 뒤 재제출 판단을 한다.
