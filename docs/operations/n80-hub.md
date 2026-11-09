# N80 Hub

N80 Engine의 `hub` 모듈. 소스 패키지, 호스트 자동화, 실행 영수증을 호스트에서 소유한다.
관리자 화면은 `/noa-hub.php`이며 홈페이지 설정의 시스템·점검에 등록된다.

전체 소스 초기 스냅샷과 Git bundle은 호스트 비공개 저장소에 보관한다. Git bundle은 변경 이력을 포함하며 GitHub 연결 없이 로컬 Git으로 복원할 수 있다. 이후 공개 파일 수정은 native release 패키지와 원본 해시로 보존한다. 배포 도구 client.py와 운영 지침도 호스트에 복사한다.

## 직접 배포

운영자의 별도 배포키는 웹 루트 밖 `/hosting/noastudio/noa-hub/access.key`에 있다.
SSH 운영 경로에서 권한 0600 파일로 전달받고 `N80_HUB_KEY_FILE`로 지정한다.
값을 소스·로그·대화·공개 결과물에 저장하지 않는다. 자동화 worker.key는 배포 권한이 없다.
GitHub 토큰·저장소·Actions 실행 ID는 이 경로에서 사용하지 않는다.

1. `python scripts/n80_hub_client.py manifest noa-app/engine/example.php > before.json`
2. `python scripts/n80_hub_client.py prepare noa-app/engine/example.php=deploy/noa-app/engine/example.php --manifest before.json --package release.json`
3. `python scripts/n80_hub_client.py apply --package release.json`

응답이 유실되면 **같은 release.json**을 재전송한다. 새 ID를 생성하지 않는다.
소스 리비전과 파일별 원본 SHA256이 모두 일치해야 적용된다. 코어·회원 데이터·음원·DB 설정은 대상이 아니다.
전용 API는 요청 시각·본문 HMAC·nonce와 별도 키를 검사한다. 관리자 화면에서는 로그인과 CSRF를 검사한다.
중단된 배포는 `recover` 또는 관리자 복구 버튼으로 복원한다. 다른 작업의 후속 변경은 덮어쓰지 않는다.

## 호스트 실행

`runtime/hub/runner.mjs`는 기존 검증된 호스트 Node로 실행되며 고정된 operation만 호출한다.
control.json의 activeOperations가 단일 실행 담당이다. 실행 미확인·정지 상태에서도 GitHub로 자동 우회하지 않는다.
업무 대기열·MySQL lease는 기존 소유 모듈을 유지한다. scheduler.json은 유실된 응답에 같은 실행 ID를 재사용한다.
receipts.json은 완료 근거를 보존하고 미확인 실행을 새 ID로 중복 실행하지 않는다.
호스트가 프로세스를 종료하면 관리자 시작·복구로 재시작한다. OS 서비스/cron 제공 여부는 별도 확인 대상이다.

## 이전 범위와 제한

초기 부트스트랩만 기존 GitHub 배포 자격증명을 사용한다. 호스트의 소스·배포·스케줄 실행 경로는 별도다.
각 기능은 호스트 실행 영수증 성공과 기존 실행 담당 해제 후에만 이전 완료로 보고한다.
config/n80-hub-dependencies.json은 기존 워크플로 목록과 아직 검증되지 않은 기능을 명시한다.
음원/쇼츠 전체 처리, 비공개 ChatGPT 실행기, 브라우저, Android 빌드, 과거 유지관리 작업은 자동으로 이식됐다고 간주하지 않는다.
현재 호스트에는 /proc·기본 Python·Java·cron이 없으며, 브라우저 sandbox 제한을 우회하지 않는다.
원본 저장소는 마지막 검증 전까지 삭제하지 않는다.
