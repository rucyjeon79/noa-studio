# 6. GitHub Actions 선택 배포

워크플로: `.github/workflows/dothome-ftp.yml`. `main` 푸시로는 실행되지 않는다. Actions 화면에서 수동 실행하고 확인 칸에 `DEPLOY`를 입력해야 한다.

올리는 경로만 고른다.

- `theme/noastudio/`
- `noa-api/`
- `extend/noa.studio.php`

`deploy/noastudio/noa/data`의 PGLite와 곡 JSON은 묶음에 넣지 않는다. `dangerous-clean-slate`는 꺼 둔다. 원격의 그누보드 핵심, `config.php`, `data/`, 업로드, DB는 업로드 목록에 없으므로 이번 설계가 지우지 않는다.

비밀값은 `DOTHOME_FTP_HOST`, `DOTHOME_FTP_USERNAME`, `DOTHOME_FTP_PASSWORD`다. 소스에는 없다. 이 환경의 GitHub 토큰은 Secrets 목록 조회가 403이었다. 저장소 Settings → Secrets and variables → Actions에서 직접 넣어야 한다.

포트는 워크플로에 21로 적혀 있다. 비밀번호가 아니라서 비밀값으로 두지 않았다. FTP 방식이며 FTPS와 SFTP는 쓰지 않는다. 닷홈 일반 호스팅에서 SFTP가 되는지는 확인하지 않았다.

서버 디렉터리는 수동 실행 입력값이고 기본은 `/hosting/noastudio/html/`이다. FTP 계정의 시작 폴더가 이미 `html`이면 한 단계 더 들어간다. 그 경우에도 새 폴더가 생길 뿐 기존 파일을 지우지는 않는다. 첫 실행 전에 시작 폴더를 확인해야 한다.

이번 작업에서는 워크플로를 실행하지 않았고 FTP에도 접속하지 않았다.
