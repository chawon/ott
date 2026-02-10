# TWA Google Play 출시 체크리스트

## 목적
- `kr.pe.preview.ott.twa` 앱을 Google Play에 안정적으로 출시
- 내부 테스트에서 프로덕션 출시까지 단계적으로 검증

## 기준 정보 (출시 전 고정)
- 패키지명: `kr.pe.preview.ott.twa`
- 도메인: `https://ott.preview.pe.kr`
- 앱명: `On the Timeline (OTT)`

## 1) 서명/보안 준비
- [ ] release keystore 최종 확정 (분실 방지 백업 포함)
- [ ] GitHub Secrets 최신화
  - `TWA_KEYSTORE_BASE64`
  - `TWA_KEYSTORE_PASSWORD`
  - `TWA_KEY_ALIAS`
  - `TWA_KEY_PASSWORD`
- [ ] release keystore SHA-256 fingerprint 확인
- [ ] `apps/web/public/.well-known/assetlinks.json`에 release fingerprint 반영
- [ ] 배포된 도메인에서 `/.well-known/assetlinks.json` 접근 확인

## 2) 빌드/아티팩트 준비
- [ ] GitHub Actions `Build TWA Release AAB` 실행
- [ ] 결과물 `app-release.aab` 다운로드
- [ ] AAB 파일명에 버전 식별 정보 추가 보관 (예: 날짜/릴리즈 태그)

## 3) Play Console 앱 설정
- [ ] Play Console에서 앱 생성 (패키지명 일치 확인)
- [ ] 앱 카테고리/연락처/정책 URL 입력
- [ ] 개인정보처리방침 URL 입력
- [ ] Data safety(데이터 수집/처리) 설문 작성
- [ ] 콘텐츠 등급 설문 완료
- [ ] 광고 여부 설정

## 4) 스토어 등록정보 준비
- [ ] 앱 이름/짧은 설명/상세 설명 작성
- [ ] 앱 아이콘/피처 그래픽 업로드
- [ ] 휴대폰 스크린샷 업로드
- [ ] 한국어 기본 메타데이터 검토 (필요 시 다국어 추가)

## 5) 테스트 트랙 배포 (권장 순서)
- [ ] 내부 테스트 트랙에 AAB 업로드
- [ ] 테스터 설치 확인 (Play를 통한 설치)
- [ ] 핵심 시나리오 점검
  - [ ] 앱 실행/스플래시/스탠드얼론 동작
  - [ ] 로그인/로그아웃
  - [ ] 기록 생성/수정/삭제
  - [ ] 공유 기능
  - [ ] 딥링크 진입
- [ ] 이슈 수정 후 내부 테스트 재배포
- [ ] 클로즈드 테스트(필요 시) 확장

## 6) 프로덕션 출시
- [ ] 프로덕션 트랙에 릴리즈 생성
- [ ] 변경사항(Release notes) 작성
- [ ] 점진 배포(예: 10% -> 50% -> 100%) 전략 적용
- [ ] 롤백 기준/담당자 사전 합의

## 7) 출시 후 모니터링
- [ ] Crash/ANR 모니터링 (출시 직후 24~72시간 집중)
- [ ] 로그인/기록 저장 성공률 점검
- [ ] 사용자 피드백/리뷰 모니터링
- [ ] 긴급 패치 여부 판단

## 운영 메모
- WSL(ARM Linux) 환경 호환 제약으로 로컬 Android 빌드는 비권장
- APK/AAB는 GitHub Actions를 기준으로 생성/배포
- 키 유출이 의심되면 즉시 키 교체 및 CI 시크릿 전면 갱신
