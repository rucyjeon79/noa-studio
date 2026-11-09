# NOA 관리자 전용 곡 생성
닷홈이 비공개 저장소의 workflow_dispatch에 작업 ID를 보내면 GitHub 호스팅 실행기가 해당 작업만 처리합니다. 개인 PC는 필요하지 않습니다.

닷홈 PHP 환경의 NOA_GITHUB_DISPATCH_TOKEN은 이 저장소에만 Actions 쓰기 권한이 필요합니다. 저장소 Actions secrets에는 NOA_WORKER_KEY(관리자 연결 키), NOA_CODEX_AUTH(본인 Codex의 ChatGPT 로그인 JSON), NOA_SECRET_ROTATION_TOKEN(이 저장소의 Secrets 쓰기 권한)을 설정합니다. 로그인 파일과 토큰은 채팅이나 저장소 파일에 올리지 않습니다. 실행기는 갱신된 로그인 정보를 같은 secret에 저장합니다.

## Gemini 연결 상태 (2026-11-09 확인)

개인용 Gemini CLI의 Google 로그인은 2026-06-18 종료되었다. Google AI Pro/Ultra
구독을 과거 `oauth_creds.json`으로 GitHub 실행기에 연결하는 경로는 사용하지 않는다.
`gemini.py`는 `connected: false`, `gemini_consumer_cli_retired`를 보고하며 호출·파일
읽기·API 자동 전환을 하지 않는다. 연결 파일 수집과 토큰 갱신 단계는 제거했다.
기존 ChatGPT 지휘관 및 N80 작업 처리는 계속 유지한다.

후속 공식 제품은 Antigravity이다. 개인 구독은 최초 대화형 로그인과 OS 키링을
사용하며, headless 실행도 사전 인증이 필요하다. 현재 GitHub hosted runner에서
그 인증을 지속시키는 방식은 검증되지 않았다. 새 실행자는 실제 인증·응답 검증,
N80 작업 소유권 및 비용 조건을 충족하기 전까지 활성화하지 않는다. 텍스트 실행
지원만으로 기존 Gem 이미지 생성이나 Flow 영상 생성 연결을 선언하지 않는다.

공식 근거:
- https://developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals
- https://antigravity.google/docs/install
- https://antigravity.google/docs/cli/headless/
