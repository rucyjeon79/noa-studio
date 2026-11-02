# NOA 관리자 전용 곡 생성 실행기

1. 관리자만 접근하는 비공개 GitHub 저장소에 worker.py를 루트로 복사하고 noa-worker.yml을 .github/workflows/noa-worker.yml로 복사합니다.
2. 해당 저장소에만 연결된 전용 Linux self-hosted runner에 noa-private 라벨을 붙입니다. Python 3와 Codex CLI를 설치하고 실행기 사용자로 codex login을 진행합니다. 이 환경에는 API 키, 추가 MCP 서버, 프로젝트 지침 또는 외부 플러그인을 등록하지 않습니다.
3. NOA의 /noa-gpt-setup.php에서 관리자 전용 비공개 실행기를 펼쳐 연결 키를 발급하고 비공개 저장소의 Actions secret NOA_WORKER_KEY에 저장합니다.
4. 비공개 저장소에서 NOA private song worker를 한 번 실행한 뒤 곡 편집기를 다시 엽니다. 예약 실행 사이에 대기 시간이 있거나 실행기가 꺼져 있으면 오프라인으로 표시됩니다. 실행기 연결 해제를 누르면 기존 설정으로 돌아갑니다.
