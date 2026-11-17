# N80 GitHub 실행 환경 검증 — 2026-11-17

사용자 요청: N80 전용 ChatGPT·Gemini·Flow 실행 환경을 기존 GitHub로 해결.
호스트 상주 실행기는 계속 폐기 상태이며, N80이 요청 ID·권한·lease·원본 버전·결과 검증을 소유한다.

## 실제 완료

- 기존 ChatGPT 구독으로 고정 소프트웨어 검증 요청의 응답을 생성했다. 새 유료 모델 API를 연결하지 않았다.
  [런타임 검증 44066254324](https://github.com/rucyjeon79/noa-private-worker/actions/runs/44066254324), 19:35 KST.
- GitHub의 sandbox가 활성화된 Chrome에서 JavaScript 실행 및 Gemini·Flow HTTP 접속을 확인했다. 이 결과의 인증 여부와 제작 가능 여부는 둘 다 false다.
- N80에서 만든 비공개 검증 초안 한 건을 private GitHub workflow로 전달하고, 기존 ChatGPT 구독으로 창작 질문을 생성한 뒤 N80에 저장했다.
  [실제 왕복 검증 44068970985](https://github.com/rucyjeon79/noa-private-worker/actions/runs/44068970985), 19:54 KST.
  실행 로그는 `saved=true`, `state=succeeded`, `decisions=2`를 반환했다. N80 창작 화면에서도 생성된 질문을 확인했다. 공개 곡 등록이나 게시는 수행하지 않았다.
- private worker는 명시적 task_id 한 건만 받는다. 자동 push/cron 생성은 없고 실행은 420초로 제한한다. 인증 갱신 보관·정리도 실제 성공했다. 구독 인증 검증과 같은 동시 실행 잠금을 사용한다.

## 코드·배포

- 운영 소스: `660be93127fa36238c8868373dcc6fcb8639490c`.
- private 작업 workflow: `f12805870b334d430d3d18e09d84b7e8e3577954`.
- N80 Hub 배포: `5be97da468a316814acafbd67a94cb90`, revision 511.
- 변경한 호스트 파일: `noa-app/engine/github-runtime.php`, `noa-app/engine/auto-dispatch.php`, `noa-browser-connect.php`, `noa-bridge/browser-control.php`.
- 서버 파일 4개의 SHA-256 재조회 일치. 기존 소스 백업과 배포 패키지를 Google Drive에 저장하고 검증했다.
- 브라우저 연결은 관리자 connection_id 한 건만 받아 최대 15분 작동한다. 늦게 도착한 요청은 새 연결을 claim할 수 없다. 현재 Google 로그인 거부 상태는 삭제·초기화하지 않았다.
- 자동 계약 검사와 수동 호스트 연결 workflow를 분리했다. 기존 호스트 접속 보호 규칙을 완화하지 않았다.

## 검증 결과

- 브라우저 Python 테스트 9개 통과: 암호화·비밀정보 격리·잘못된 ID/실행 소유권·안전한 진단.
- PHP 브라우저 계약 통과: 소유권·lease·암호화·중복 요청·만료·프로필 체크섬·과거 ID 차단·Google 거절 후 중단.
- PHP 문법, PHP 8.2/8.3 엔진 계약, 기존 기능/SQL/MP3 회귀 검사 통과.
- 예약·호스트 접속 보호 검사 통과. 자동 반복 업무 또는 상주 실행기는 시작하지 않았다.

## 남은 차단과 다음 조건

- N80 Google 연결 화면은 `Google이 이 연결용 브라우저의 로그인을 거부했습니다`라고 표시한다. 이 세션의 재로그인·저장은 중지 상태로 보존했다.
- Gemini·Flow 로그인, 이미지/영상 생성, 파일 회수, N80 저장·검수는 아직 검증되지 않았다. 새 브라우저 연결 workflow의 실제 인증 왕복도 미완료다.
- Google의 허용된 인증 경로가 해결되기 전 자동 로그인 재시도, 세션 초기화, 브라우저 탐지 우회나 다른 환경의 쿠키 반입을 하지 않는다.
- 예약 자동쇼츠의 전체 제작·게시 실행은 아직 활성화하지 않았다. 채널의 기존 자동 운영 설정과 YouTube 연결은 변경하지 않았다.
- ChatGPT 단발 실행 성공을 Gemini·Flow 또는 무인 영상 제작 전체 성공으로 확대 보고하지 않는다.
