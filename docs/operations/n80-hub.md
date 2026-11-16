# N80 Hub

N80 Engine의 `hub` 모듈. 소스 패키지, 인증된 단발 요청과 실행 영수증을 기존 호스트에서 소유한다. 구형 상주 실행기는 2026-11-17 물리적으로 폐기했다.
관리자 화면은 `/noa-hub.php`이며 홈페이지 설정의 시스템·점검에 등록된다.

전체 소스 초기 스냅샷과 Git bundle은 호스트 비공개 저장소에 보관한다. Git bundle은 변경 이력을 포함하며 GitHub 연결 없이 로컬 Git으로 복원할 수 있다. 후속 변경은 source.json에 기록된 history-<commit>.bundle을 순서대로 적용한다. 각 묶음의 기준 commit과 SHA256을 검증한다. 이후 공개 파일 수정은 native release 패키지와 원본 해시로 보존한다. 배포 도구 client.py와 운영 지침도 호스트에 복사한다.

## 직접 배포

ChatGPT의 기존 NOA STUDIO Assistant 연결에서는 `noa_hub_source`로 최신 원본 해시·리비전을 읽고 `noa_hub_release`로 변경분만 배포한다. 기존 관리자 인증을 유지하며 GitHub Actions SSH·업무 실행을 사용하지 않는다. 아래 CLI는 별도 운영키가 이미 제공된 운영자 환경의 보조 경로다.

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

## 호스트 실행과 폐기 확인

구형 `launch.mjs`, `runner.mjs`, `stop.mjs`, `probe.mjs`는 호스트와 현재 저장소에서 모두 제거됐다. 관리자 시작·재개, SSH bootstrap, heartbeat 폴링으로 재설치·재시작하지 않는다. 기존 `stop=true`, `paused=true`는 보존한다.

N80 전문 모듈은 인증된 단발 요청으로 처리하고 각 작업 ID·권한·중복 방지·결과 영수증으로 실행을 검증한다. 업무 대기열·MySQL lease·과거 scheduler/receipts 기록은 지우거나 성공으로 재분류하지 않는다. 상주 heartbeat가 오래됐거나 `runnerState=not_verified`여도 재시작 근거가 되지 않는다.

`noa_hub_retire_resident(phase="verify")`와 별도 `noa_hub_status`로 삭제 영수증, 4개 파일의 `present=false`, `launcherInstalled=false`, 잠금 부재 및 관리 API 응답을 확인한다. 검증은 작업 실행이나 프로세스 시작을 유발하지 않는다. 폐기 완료 후 `backup`·`apply`를 반복할 필요가 없다.

원본 ZIP은 기존 비공개 Google Drive 백업 폴더에 저장하고 전체 재다운로드 바이트 비교 및 제공된 v2 `check_drive_proof`를 통과했다. ZIP SHA-256:
`75a993afe2ccc4d072000d5ca7df4156cb3f01a40ff3c0067ac0a01561244cb0`.
비공개 백업 주소와 파일별 해시는 관리자 삭제 영수증에 보관하며 공개 저장소에 게시하지 않는다. GitHub 정리 기록은 `config/n80-github-cleanup.json`에 있다.

## 이전 범위와 제한

기존 상주 실행기 부트스트랩은 폐기됐다. GitHub는 소스 이력·검사와 승인된 자동쇼츠 단발 Wake 신호 범위에서 사용한다. Android 수동 빌드·서명·배포 예외는 `AGENTS.project.md`의 별도 승인 범위를 따른다.
각 기능은 호스트 실행 영수증 성공과 기존 실행 담당 해제 후에만 이전 완료로 보고한다.
config/n80-hub-dependencies.json은 기존 워크플로 목록과 아직 검증되지 않은 기능을 명시한다.
음원/쇼츠 전체 처리, 비공개 ChatGPT 실행기, 브라우저, Android 빌드, 과거 유지관리 작업은 자동으로 이식됐다고 간주하지 않는다.
현재 호스트에는 /proc·기본 Python·Java·cron이 없으며, 브라우저 sandbox 제한을 우회하지 않는다.
원본 저장소는 마지막 검증 전까지 삭제하지 않는다.

## 확인된 호스트 통신

공개 도메인으로의 호스트 자체 호출은 시간 초과를 반환했다. HTTPS loopback은 실제 응답을 검증했으며 원래 도메인의 SNI·인증서 검사와 HMAC 인증을 유지한다. 새 전용 포트나 외부 스케줄러는 없다. 이 기록은 과거 통신 검증이며 상주 실행기의 재시작을 허용하지 않는다.

## 과거 업무 전환 검증 — 2026-11-10 (현재 실행 승인 아님)

작업 실행 42728824359에서 hub.verify, ai.text, ai.batch, catalog.index, notifications.dispatch, popularity.calculate, members.maintain의 호스트 영수증이 모두 succeeded로 확인됐다. 공개 소유권 조회도 n80_hub를 반환한다. 텍스트 영수증은 대기열 점검의 성공이며 ChatGPT 계정 생성 실행기의 완전 이관을 뜻하지 않는다.

당시 실행 영수증은 역사 기록으로 보존한다. 해당 기록은 현재의 GitHub 업무 실행이나 상주 worker 유지 승인이 아니다. 현재 정책은 `AGENTS.project.md`의 2026-11-16~17 확정 사항을 따른다. 기존 곡 색인 배포 검사는 새로 생성하지 않고 저장된 색인과 공개 영상 수만 조회한다.

Hub 배포에는 [n80-hub] 표시를 사용한다. 해당 변경을 전체 사이트 배포 workflow가 다시 적용하지 않는다. 초기 변경 이력·후속 bundle·native 배포 패키지는 관리자 화면에서 각각 내려받을 수 있다.

## 독립 버전 저장소

호스트의 `/hosting/noastudio/noa-hub/repository.git`은 로컬 bundle만 사용해 복원하는 비공개 bare Git 저장소다. SSH를 통한 Git 접근을 사용할 수 있으며 배포는 별도의 검증 패키지 절차를 따른다. 저장소 복원은 전체 bundle 해시, 순서, commit, fast-forward, fsck, 최종 HEAD를 검사한다. 사용자가 만든 후속 commit이 발견되면 덮어쓰지 않는다. Git 저장소에는 GitHub 이슈·PR·Actions 실행 메타데이터나 GitHub에만 있는 계정 인증 자료가 포함되지 않는다.

## 곡 카드 이미지 자동 보완

`covers.refresh`는 기존 `suno-cover.php`의 공개 메타데이터·이미지 변환과 JukeBox 저장 경로를 사용한다. 인증된 단발 호출 한 번에 최대 4개를 순차 처리한다. 모듈 등록만으로 주기 실행이 활성화되는 것은 아니다. 음원 파일과 분석값은 변경하지 않으며 곡 리비전·소유자·Suno URL을 SQL 잠금 안에서 다시 확인한다. 사용자가 등록한 검증된 이미지는 보존한다.

실패한 요청은 비공개 `covers-retry.json`에 보존하고 다음 승인된 단발 호출에서 기존 간격·횟수 제한을 검사한다. 기존 GitHub 캐시가 있으면 최초 전환 시에만 인수한다. `covers-result.json`은 처리 수·재시도 수·남은 수를 보관한다. 요청 가능한 원본 이미지가 없는 곡은 완료로 꾸미지 않고 남은 수에 포함한다.

기존 큐와 결과를 보존하며 실제 완료 영수증으로 판정한다. 폐기된 상주 실행기나 GitHub 업무 워크플로를 이미지 보완 목적으로 재가동하지 않는다.
