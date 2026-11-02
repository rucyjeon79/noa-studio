# NOA 관리자 전용 곡 생성
닷홈이 비공개 저장소의 workflow_dispatch에 작업 ID를 보내면 GitHub 호스팅 실행기가 해당 작업만 처리합니다. 개인 PC는 필요하지 않습니다.

닷홈 PHP 환경의 NOA_GITHUB_DISPATCH_TOKEN은 이 저장소에만 Actions 쓰기 권한이 필요합니다. 저장소 Actions secrets에는 NOA_WORKER_KEY(관리자 연결 키), NOA_CODEX_AUTH(본인 Codex의 ChatGPT 로그인 JSON), NOA_SECRET_ROTATION_TOKEN(이 저장소의 Secrets 쓰기 권한)을 설정합니다. 로그인 파일과 토큰은 채팅이나 저장소 파일에 올리지 않습니다. 실행기는 갱신된 로그인 정보를 같은 secret에 저장합니다.
