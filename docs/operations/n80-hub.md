# N80 Hub

N80 Engine의 `hub` 모듈. 소스 패키지, 호스트 자동화, 실행 영수증을 호스트에서 소유한다.
관리자 화면은 `/noa-hub.php`이며 홈페이지 설정의 시스템·점검에 등록된다.

전체 소스 초기 스냅샷과 Git bundle은 호스트 비공개 저장소에 보관한다. Git bundle은 변경 이력을 포함하며 GitHub 연결 없이 로컬 Git으로 복원할 수 있다. 후속 변경은 source.json에 기록된 history-<commit>.bundle을 순서대로 적용한다. 각 묶음의 기준 commit과 SHA256을 검증한다. 이후 공개 파일 수정은 native release 패키지와 원본 해시로 보존한다. 배포 도구 client.py와 운영 지침도 호스트에 복사한다.

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

## 확인된 호스트 통신

공개 도메인으로의 호스트 자체 호출은 시간 초과를 반환했다. HTTPS loopback은 실제 응답을 검증했으며 원래 도메인의 SNI·인증서 검사와 HMAC 인증을 유지한다. 새 전용 포트나 외부 스케줄러는 없다. 실행기는 고정 작업 목록을 갱신하고, 프로토콜 업그레이드 시 기존 PID를 종료한 뒤 같은 저장소로 재시작한다.

## 업무 전환 검증 — 2026-11-10

작업 실행 42728824359에서 hub.verify, ai.text, ai.batch, catalog.index, notifications.dispatch, popularity.calculate, members.maintain의 호스트 영수증이 모두 succeeded로 확인됐다. 공개 소유권 조회도 n80_hub를 반환한다. 텍스트 영수증은 대기열 점검의 성공이며 ChatGPT 계정 생성 실행기의 완전 이관을 뜻하지 않는다.

회원 정리·알림·인기 집계·곡 색인의 GitHub schedule을 해제한다. 수동 진입은 호스트 소유권을 확인하고 중복 실행을 거절한다. 미디어·브라우저를 함께 맡는 기존 worker는 유지하되 텍스트·묶음·색인은 서버에서 차단한다. 기존 곡 색인 배포 검사는 새로 생성하지 않고 저장된 색인과 공개 영상 수만 조회한다.

Hub 배포에는 [n80-hub] 표시를 사용한다. 해당 변경을 전체 사이트 배포 workflow가 다시 적용하지 않는다. 초기 변경 이력·후속 bundle·native 배포 패키지는 관리자 화면에서 각각 내려받을 수 있다.

## 독립 버전 저장소

호스트의 `/hosting/noastudio/noa-hub/repository.git`은 로컬 bundle만 사용해 복원하는 비공개 bare Git 저장소다. SSH를 통한 Git 접근을 사용할 수 있으며 배포는 별도의 검증 패키지 절차를 따른다. 저장소 복원은 전체 bundle 해시, 순서, commit, fast-forward, fsck, 최종 HEAD를 검사한다. 사용자가 만든 후속 commit이 발견되면 덮어쓰지 않는다. Git 저장소에는 GitHub 이슈·PR·Actions 실행 메타데이터나 GitHub에만 있는 계정 인증 자료가 포함되지 않는다.

## 곡 카드 이미지 자동 보완

`covers.refresh`는 기존 `suno-cover.php`의 공개 메타데이터·이미지 변환과 JukeBox 저장 경로를 사용한다. 한 번에 최대 4개를 순차 처리하고 3분마다 검사한다. 음원 파일과 분석값은 변경하지 않으며 곡 리비전·소유자·Suno URL을 SQL 잠금 안에서 다시 확인한다. 사용자가 등록한 검증된 이미지는 보존한다.

실패한 요청은 비공개 `covers-retry.json`에 저장하고 최대 하루 간격으로 재시도한다. 기존 GitHub 캐시가 있으면 최초 전환 시에만 인수한다. `covers-result.json`은 처리 수·재시도 수·남은 수를 보관한다. 요청 가능한 원본 이미지가 없는 곡은 완료로 꾸미지 않고 남은 수에 포함한다.

호스트 단일 소유권과 실제 실행 영수증을 확인한 뒤 해당 GitHub 예약 실행을 해제한다. 부트스트랩은 기존 배포 동시 실행 잠금을 공유하므로 이전 이미지 실행기가 끝난 후 전환한다.
