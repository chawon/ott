# ChatGPT Directory Screenshots

ottline ChatGPT 앱 디렉터리 제출용 스크린샷 자산 모음.

## Files

- `screenshot-recent-706x860.png`
- `screenshot-movies-706x860.png`
- `screenshot-series-706x860.png`
- `screenshot-recent-1412x1720@2x.png`
- `screenshot-movies-1412x1720@2x.png`
- `screenshot-series-1412x1720@2x.png`

## Source

- 생성 스크립트: `apps/web/scripts/generate-chatgpt-directory-screenshots.mjs`
- 실제 위젯 템플릿: `apps/web/public/chatgpt-widget-v2.html`
- 생성 기준일: `2026-04-22`

## Notes

- 실제 `chatgpt-widget-v2.html`에 mock bridge를 붙여 브라우저에서 렌더한 결과만 캡처한다.
- 위젯 UI만 보여주고, 프롬프트/모델 응답/브라우저 크롬은 넣지 않는다.
- 기본 제출 규격은 `706x860`이고, 동일 프레임의 `@2x`도 함께 생성한다.
- 스크린샷은 정적 SVG 목업이 아니라 실제 위젯 브라우저 렌더 결과를 캡처한다.
